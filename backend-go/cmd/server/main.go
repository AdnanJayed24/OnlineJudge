package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"onlinejudge/internal/config"
	"onlinejudge/internal/db"
	"onlinejudge/internal/handlers"
	"onlinejudge/internal/middleware"
	"onlinejudge/internal/queue"
	"onlinejudge/internal/rdb"
	"onlinejudge/internal/socket"
	"onlinejudge/internal/worker"
)

func main() {
	// Load .env if present (ignore error if not found)
	_ = godotenv.Load()

	if err := config.Load(); err != nil {
		log.Fatalf("[main] config error: %v", err)
	}

	db.Init()
	rdb.Init()
	queue.Init()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Start background worker (replaces the separate worker process)
	go worker.Start(ctx)

	// Create WebSocket hub and start its Redis subscriber
	hub := socket.NewHub()
	go hub.StartRedisSubscriber(ctx)

	// Build Gin router
	gin.SetMode(gin.ReleaseMode)
	if os.Getenv("GIN_MODE") == "debug" {
		gin.SetMode(gin.DebugMode)
	}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{config.C.FrontendOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })

	// WebSocket endpoint (replaces Socket.IO)
	r.GET("/api/ws", func(c *gin.Context) { hub.HandleWS(c.Writer, c.Request) })

	api := r.Group("/api")

	// Auth routes
	auth := api.Group("/auth")
	auth.POST("/register", handlers.Register)
	auth.POST("/login", handlers.Login)
	auth.POST("/logout", handlers.Logout)
	auth.POST("/refresh", handlers.Refresh)
	auth.GET("/me", middleware.Authenticate(), handlers.Me)

	// Problem routes
	problems := api.Group("/problems")
	problems.GET("", middleware.OptionalAuth(), handlers.ListProblems)
	problems.GET("/:slug", handlers.GetProblem)
	problems.POST("", middleware.Authenticate(), handlers.CreateProblem)
	problems.POST("/fetch", middleware.Authenticate(), handlers.FetchProblem)

	// Submission routes
	subs := api.Group("/submissions")
	subs.Use(middleware.Authenticate())
	subs.POST("", handlers.Submit)
	subs.GET("/:id", handlers.GetSubmission)
	subs.GET("", handlers.ListSubmissions)

	// Run route
	api.POST("/run", middleware.Authenticate(), handlers.RunCode)

	// Codeforces admin routes
	cf := api.Group("/codeforces")
	cf.POST("/sync/contest", middleware.Authenticate(), handlers.SyncContest)
	cf.POST("/sync/problemset", middleware.Authenticate(), handlers.SyncProblemset)

	// 404 handler
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	})

	addr := fmt.Sprintf(":%d", config.C.Port)
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		log.Printf("[server] running on http://0.0.0.0%s\n", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[server] listen error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("[server] shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)

	queue.Close()
	log.Println("[server] stopped")
}
