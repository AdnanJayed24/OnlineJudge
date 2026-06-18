package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strconv"

	"github.com/hibiken/asynq"
	"onlinejudge/internal/config"
	"onlinejudge/internal/queue"
	"onlinejudge/internal/services"
)

func Start(ctx context.Context) {
	opt := parseRedisURL(config.C.RedisURL)
	srv := asynq.NewServer(opt, asynq.Config{
		Concurrency: 5,
		Queues:      map[string]int{"default": 1},
	})

	mux := asynq.NewServeMux()
	mux.HandleFunc(queue.TaskTypeJudge, handleJudgeTask)

	go func() {
		log.Println("[worker] starting")
		if err := srv.Run(mux); err != nil {
			log.Printf("[worker] error: %v\n", err)
		}
	}()

	<-ctx.Done()
	srv.Shutdown()
	log.Println("[worker] stopped")
}

func handleJudgeTask(ctx context.Context, t *asynq.Task) error {
	var p queue.JudgePayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}
	if p.SubmissionID == 0 {
		return fmt.Errorf("invalid submission_id")
	}
	return services.RunJudge(ctx, p.SubmissionID)
}

func parseRedisURL(rawURL string) asynq.RedisClientOpt {
	u, err := url.Parse(rawURL)
	if err != nil || u.Host == "" {
		return asynq.RedisClientOpt{Addr: "localhost:6379"}
	}
	host := u.Hostname()
	port := u.Port()
	if port == "" {
		port = "6379"
	}
	var password string
	if u.User != nil {
		password, _ = u.User.Password()
	}
	db := 0
	if len(u.Path) > 1 {
		db, _ = strconv.Atoi(u.Path[1:])
	}
	return asynq.RedisClientOpt{Addr: host + ":" + port, Password: password, DB: db}
}
