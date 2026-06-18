package services

import (
	"onlinejudge/internal/db"
	"onlinejudge/internal/models"
	"onlinejudge/internal/queue"
)

func CreateSubmission(userID, problemID int, language, sourceCode string) (*models.Submission, error) {
	sub := models.Submission{
		UserID:     userID,
		ProblemID:  problemID,
		Language:   language,
		SourceCode: sourceCode,
		Status:     "QUEUED",
	}
	if err := db.DB.Create(&sub).Error; err != nil {
		return nil, err
	}
	if err := queue.Enqueue(sub.ID); err != nil {
		return nil, err
	}
	return &sub, nil
}

func GetSubmission(id int) (*models.Submission, error) {
	var sub models.Submission
	err := db.DB.Preload("Result").Where("id = ?", id).First(&sub).Error
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

type SubmissionListProblem struct {
	Title string `json:"title"`
	Slug  string `json:"slug"`
}

type SubmissionListItem struct {
	ID         int                      `json:"id"`
	UserID     int                      `json:"userId"`
	ProblemID  int                      `json:"problemId"`
	Language   string                   `json:"language"`
	SourceCode string                   `json:"sourceCode"`
	Status     string                   `json:"status"`
	CreatedAt  interface{}              `json:"createdAt"`
	Result     *models.SubmissionResult `json:"result"`
	Problem    *SubmissionListProblem   `json:"problem"`
}

func ListSubmissions(userID, problemID int) ([]SubmissionListItem, error) {
	var subs []models.Submission
	query := db.DB.Where("user_id = ?", userID)
	if problemID > 0 {
		query = query.Where("problem_id = ?", problemID)
	}
	err := query.
		Preload("Result").
		Preload("Problem").
		Order("created_at DESC").
		Limit(50).
		Find(&subs).Error
	if err != nil {
		return nil, err
	}

	items := make([]SubmissionListItem, len(subs))
	for i, s := range subs {
		var p *SubmissionListProblem
		if s.Problem != nil {
			p = &SubmissionListProblem{Title: s.Problem.Title, Slug: s.Problem.Slug}
		}
		items[i] = SubmissionListItem{
			ID:         s.ID,
			UserID:     s.UserID,
			ProblemID:  s.ProblemID,
			Language:   s.Language,
			SourceCode: s.SourceCode,
			Status:     s.Status,
			CreatedAt:  s.CreatedAt,
			Result:     s.Result,
			Problem:    p,
		}
	}
	return items, nil
}
