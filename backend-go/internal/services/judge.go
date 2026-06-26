package services

import (
	"context"
	"encoding/json"
	"strings"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"onlinejudge/internal/db"
	"onlinejudge/internal/judge"
	"onlinejudge/internal/models"
	"onlinejudge/internal/rdb"
)

func normalize(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = strings.TrimRight(l, " \t")
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func toJSON(v interface{}) datatypes.JSON {
	b, _ := json.Marshal(v)
	return datatypes.JSON(b)
}

func RunJudge(ctx context.Context, submissionID int) error {
	db.DB.Model(&models.Submission{}).Where("id = ?", submissionID).Update("status", "RUNNING")
	rdb.Publish(ctx, submissionID)

	var sub models.Submission
	err := db.DB.
		Preload("Problem").
		Preload("Problem.Testcases", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("id ASC")
		}).
		Where("id = ?", submissionID).First(&sub).Error
	if err != nil {
		return err
	}

	testcases := sub.Problem.Testcases
	timeLimitMs := sub.Problem.TimeLimitMs
	if timeLimitMs == 0 {
		timeLimitMs = 2000
	}
	memMb := sub.Problem.MemoryLimitMb
	if memMb == 0 {
		memMb = 256
	}

	type tcDetail struct {
		Index  int    `json:"index"`
		Status string `json:"status"`
	}
	details := make([]tcDetail, len(testcases))
	for i := range testcases {
		details[i] = tcDetail{Index: i + 1, Status: "QUEUED"}
	}

	upsertResult(submissionID, "RUNNING", nil, toJSON(details))
	rdb.Publish(ctx, submissionID)

	verdict := "ACCEPTED"
	totalMs := 0

	for i, tc := range testcases {
		details[i].Status = "RUNNING"
		updateResult(submissionID, "RUNNING", &totalMs, toJSON(details))
		rdb.Publish(ctx, submissionID)

		result, err := judge.Run(sub.Language, sub.SourceCode, tc.Input, timeLimitMs, memMb)
		var tcStatus string
		if err != nil {
			tcStatus = "RUNTIME_ERROR"
			verdict = "RUNTIME_ERROR"
		} else if result.CompilationError {
			tcStatus = "COMPILATION_ERROR"
			verdict = "COMPILATION_ERROR"
		} else if result.TimedOut {
			tcStatus = "TIME_LIMIT_EXCEEDED"
			verdict = "TIME_LIMIT_EXCEEDED"
		} else if result.ExitCode != 0 {
			tcStatus = "RUNTIME_ERROR"
			verdict = "RUNTIME_ERROR"
		} else if normalize(result.Stdout) == normalize(tc.ExpectedOutput) {
			tcStatus = "PASSED"
		} else {
			tcStatus = "FAILED"
			verdict = "WRONG_ANSWER"
		}

		if result != nil {
			totalMs += result.RuntimeMs
		}
		details[i].Status = tcStatus
		updateResult(submissionID, "RUNNING", &totalMs, toJSON(details))
		rdb.Publish(ctx, submissionID)

		if verdict != "ACCEPTED" {
			break
		}
	}

	upsertResult(submissionID, verdict, &totalMs, toJSON(details))
	db.DB.Model(&models.Submission{}).Where("id = ?", submissionID).Update("status", verdict)
	rdb.Publish(ctx, submissionID)
	return nil
}

func upsertResult(submissionID int, verdict string, runtimeMs *int, details datatypes.JSON) {
	var r models.SubmissionResult
	db.DB.Where("submission_id = ?", submissionID).First(&r)
	r.SubmissionID = submissionID
	r.Verdict = verdict
	r.RuntimeMs = runtimeMs
	r.DetailsJson = details
	if r.ID == 0 {
		db.DB.Create(&r)
	} else {
		db.DB.Save(&r)
	}
}

func updateResult(submissionID int, verdict string, runtimeMs *int, details datatypes.JSON) {
	db.DB.Model(&models.SubmissionResult{}).
		Where("submission_id = ?", submissionID).
		Updates(map[string]interface{}{
			"verdict":      verdict,
			"runtime_ms":   runtimeMs,
			"details_json": details,
		})
}
