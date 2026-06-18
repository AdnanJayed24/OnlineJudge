package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port             int
	DatabaseURL      string
	JWTAccessSecret  string
	JWTRefreshSecret string
	RedisURL         string
	FrontendOrigin   string
	PistonURL        string
	CFHandle         string
	CFEmail          string
	CFPassword       string
	CFCookie         string
}

var C Config

func Load() error {
	port := 3000
	if v := os.Getenv("PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			port = n
		}
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	jwtAccess := os.Getenv("JWT_ACCESS_SECRET")
	if jwtAccess == "" {
		return fmt.Errorf("JWT_ACCESS_SECRET is required")
	}
	jwtRefresh := os.Getenv("JWT_REFRESH_SECRET")
	if jwtRefresh == "" {
		return fmt.Errorf("JWT_REFRESH_SECRET is required")
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://127.0.0.1:6379"
	}
	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:5173"
	}
	pistonURL := os.Getenv("PISTON_URL")
	if pistonURL == "" {
		pistonURL = "https://emkc.org/api/v2/piston"
	}

	C = Config{
		Port:             port,
		DatabaseURL:      dbURL,
		JWTAccessSecret:  jwtAccess,
		JWTRefreshSecret: jwtRefresh,
		RedisURL:         redisURL,
		FrontendOrigin:   frontendOrigin,
		PistonURL:        pistonURL,
		CFHandle:         os.Getenv("CF_HANDLE"),
		CFEmail:          os.Getenv("CF_EMAIL"),
		CFPassword:       os.Getenv("CF_PASSWORD"),
		CFCookie:         os.Getenv("CF_COOKIE"),
	}
	return nil
}
