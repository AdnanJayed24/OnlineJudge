package queue

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strconv"

	"github.com/hibiken/asynq"
	"onlinejudge/internal/config"
)

const TaskTypeJudge = "submission:judge"

type JudgePayload struct {
	SubmissionID int `json:"submission_id"`
}

var client *asynq.Client

func Init() {
	opt := parseRedisURL(config.C.RedisURL)
	client = asynq.NewClient(opt)
	log.Println("[queue] initialized")
}

func Enqueue(submissionID int) error {
	payload, err := json.Marshal(JudgePayload{SubmissionID: submissionID})
	if err != nil {
		return err
	}
	task := asynq.NewTask(TaskTypeJudge, payload)
	_, err = client.Enqueue(task, asynq.TaskID(fmt.Sprintf("sub-%d", submissionID)))
	return err
}

func Close() {
	if client != nil {
		client.Close()
	}
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
	addr := host + ":" + port

	var password string
	if u.User != nil {
		password, _ = u.User.Password()
	}
	db := 0
	if len(u.Path) > 1 {
		db, _ = strconv.Atoi(u.Path[1:])
	}
	return asynq.RedisClientOpt{Addr: addr, Password: password, DB: db}
}
