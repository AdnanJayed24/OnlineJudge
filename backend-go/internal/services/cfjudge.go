package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/datatypes"
	"onlinejudge/internal/config"
	"onlinejudge/internal/db"
	"onlinejudge/internal/lib"
	"onlinejudge/internal/models"
	"onlinejudge/internal/rdb"
)

const (
	cfPollIntervalMs = 3000
	cfMaxPolls       = 30
)

var cfVerdictMap = map[string]string{
	"OK":                      "ACCEPTED",
	"WRONG_ANSWER":            "WRONG_ANSWER",
	"TIME_LIMIT_EXCEEDED":     "TIME_LIMIT_EXCEEDED",
	"MEMORY_LIMIT_EXCEEDED":   "MEMORY_LIMIT_EXCEEDED",
	"RUNTIME_ERROR":           "RUNTIME_ERROR",
	"COMPILATION_ERROR":       "COMPILATION_ERROR",
	"IDLENESS_LIMIT_EXCEEDED": "TIME_LIMIT_EXCEEDED",
	"CHALLENGED":              "WRONG_ANSWER",
	"PRESENTATION_ERROR":      "WRONG_ANSWER",
	"FAILED":                  "RUNTIME_ERROR",
	"REJECTED":                "RUNTIME_ERROR",
}

func cfSetRunning(ctx context.Context, submissionID int) {
	db.DB.Model(&models.Submission{}).Where("id = ?", submissionID).Update("status", "RUNNING")
	rdb.Publish(ctx, submissionID)
}

func cfFinalise(ctx context.Context, submissionID int, result *lib.CFVerdictResult) {
	verdict := "RUNTIME_ERROR"
	if result.Verdict != nil {
		if v, ok := cfVerdictMap[*result.Verdict]; ok {
			verdict = v
		}
	}
	memMB := int(math.Round(float64(result.MemoryConsumedBytes) / (1024 * 1024)))
	details := []map[string]interface{}{{
		"passedTests": result.PassedTestCount,
		"memoryMB":    memMB,
		"cfId":        result.CfID,
	}}
	j, _ := json.Marshal(details)
	upsertResult(submissionID, verdict, &result.TimeConsumedMillis, datatypes.JSON(j))
	db.DB.Model(&models.Submission{}).Where("id = ?", submissionID).Update("status", verdict)
	rdb.Publish(ctx, submissionID)
}

func cfFailWith(ctx context.Context, submissionID int, reason string) {
	details := []map[string]interface{}{{"error": reason}}
	j, _ := json.Marshal(details)
	zero := 0
	upsertResult(submissionID, "RUNTIME_ERROR", &zero, datatypes.JSON(j))
	db.DB.Model(&models.Submission{}).Where("id = ?", submissionID).Update("status", "RUNTIME_ERROR")
	rdb.Publish(ctx, submissionID)
}

func RunCFJudge(ctx context.Context, submissionID, contestID int, cfIndex string) error {
	cfSetRunning(ctx, submissionID)

	var sub models.Submission
	if err := db.DB.Select("language, source_code").Where("id = ?", submissionID).First(&sub).Error; err != nil {
		return err
	}
	if config.C.CFHandle == "" {
		cfFailWith(ctx, submissionID, "CF_HANDLE not configured")
		return nil
	}

	submitTime := time.Now().Unix()
	if err := lib.SubmitToCodeforces(lib.CFSubmitParams{
		ContestID:    contestID,
		ProblemIndex: cfIndex,
		Language:     sub.Language,
		SourceCode:   sub.SourceCode,
	}); err != nil {
		fmt.Printf("[cf-judge] submission failed: %v\n", err)
		cfFailWith(ctx, submissionID, err.Error())
		return nil
	}

	time.Sleep(3 * time.Second)

	for poll := 0; poll < cfMaxPolls; poll++ {
		result, err := lib.PollCFVerdict(config.C.CFHandle, contestID, cfIndex, submitTime)
		if err != nil {
			fmt.Printf("[cf-judge] poll error: %v\n", err)
			time.Sleep(time.Duration(cfPollIntervalMs) * time.Millisecond)
			continue
		}
		if result == nil {
			time.Sleep(time.Duration(cfPollIntervalMs) * time.Millisecond)
			continue
		}
		if result.Verdict == nil || *result.Verdict == "TESTING" {
			rdb.Publish(ctx, submissionID)
			time.Sleep(time.Duration(cfPollIntervalMs) * time.Millisecond)
			continue
		}
		cfFinalise(ctx, submissionID, result)
		fmt.Printf("[cf-judge] done sub=%d verdict=%s\n", submissionID, *result.Verdict)
		return nil
	}

	cfFailWith(ctx, submissionID, "JUDGE_TIMEOUT")
	return nil
}

// marshalJSONBytes is a helper used by judge.go via the same package.
func marshalJSONBytes(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

// cfVerdictTesting checks if a verdict string means still running.
func cfVerdictTesting(s string) bool {
	return strings.ToUpper(s) == "TESTING"
}
