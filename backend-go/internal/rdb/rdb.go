package rdb

import (
	"context"
	"encoding/json"
	"log"
	"onlinejudge/internal/config"

	"github.com/redis/go-redis/v9"
)

var Client *redis.Client

func Init() {
	opt, err := redis.ParseURL(config.C.RedisURL)
	if err != nil {
		log.Fatalf("[rdb] invalid REDIS_URL: %v", err)
	}
	Client = redis.NewClient(opt)
	if err := Client.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("[rdb] failed to connect: %v", err)
	}
	log.Println("[rdb] connected")
}

func Publish(ctx context.Context, submissionID int) error {
	msg, _ := json.Marshal(map[string]int{"submissionId": submissionID})
	return Client.Publish(ctx, "submission:updated", string(msg)).Err()
}
