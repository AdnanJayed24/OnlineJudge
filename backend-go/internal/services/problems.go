package services

import (
	"strings"

	"github.com/lib/pq"
	"gorm.io/gorm"
	"onlinejudge/internal/db"
	"onlinejudge/internal/models"
)

type ProblemCountJSON struct {
	Submissions int `json:"submissions"`
}

type ProblemListItem struct {
	ID            int              `json:"id"`
	Title         string           `json:"title"`
	Slug          string           `json:"slug"`
	Difficulty    string           `json:"difficulty"`
	Tags          pq.StringArray   `json:"tags"`
	TimeLimitMs   int              `json:"timeLimitMs"`
	MemoryLimitMb int              `json:"memoryLimitMb"`
	Solved        bool             `json:"solved"`
}

type problemWithCount struct {
	models.Problem
	SubmissionCount int `gorm:"column:submission_count"`
}

func ListProblems(userID int, _, q string) ([]ProblemListItem, error) {
	query := db.DB.Table("problems").
		Select("problems.*, (SELECT COUNT(*) FROM submissions WHERE submissions.problem_id = problems.id) as submission_count")

	if q = strings.TrimSpace(q); q != "" {
		query = query.Where("title ILIKE ? OR ? = ANY(tags)", "%"+q+"%", strings.ToLower(q))
	}

	var rows []problemWithCount
	if err := query.Order("id ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}

	solvedSet := map[int]bool{}
	if userID > 0 {
		var solved []struct {
			ProblemID int `gorm:"column:problem_id"`
		}
		db.DB.Table("submissions").
			Select("DISTINCT problem_id").
			Where("user_id = ? AND status = 'ACCEPTED'", userID).
			Scan(&solved)
		for _, s := range solved {
			solvedSet[s.ProblemID] = true
		}
	}

	items := make([]ProblemListItem, len(rows))
	for i, r := range rows {
		tags := r.Tags
		if tags == nil {
			tags = pq.StringArray{}
		}
		items[i] = ProblemListItem{
			ID:            r.ID,
			Title:         r.Title,
			Slug:          r.Slug,
			Difficulty:    r.Difficulty,
			Tags:          tags,
			TimeLimitMs:   r.TimeLimitMs,
			MemoryLimitMb: r.MemoryLimitMb,
			Solved:        solvedSet[r.ID],
		}
	}
	return items, nil
}

func GetProblem(slug string) (*models.Problem, error) {
	var p models.Problem
	err := db.DB.
		Preload("Testcases", func(tx *gorm.DB) *gorm.DB {
			return tx.Where("is_hidden = false").Select("id, problem_id, input, expected_output").Order("id ASC")
		}).
		Where("slug = ?", slug).
		First(&p).Error
	return &p, err
}

func DeleteProblem(slug string) error {
	var p models.Problem
	if err := db.DB.Where("slug = ?", slug).First(&p).Error; err != nil {
		return err
	}
	db.DB.Where("problem_id = ?", p.ID).Delete(&models.Testcase{})
	db.DB.Where("problem_id = ?", p.ID).Delete(&models.Submission{})
	return db.DB.Delete(&p).Error
}

func insertTestcases(problemID int, inputs []CreateTestcaseInput) []models.Testcase {
	tcs := make([]models.Testcase, 0, len(inputs))
	for _, tc := range inputs {
		// Raw SQL bypasses GORM's zero-value/default handling for is_hidden
		db.DB.Exec(
			"INSERT INTO testcases (problem_id, input, expected_output, is_hidden) VALUES (?, ?, ?, ?)",
			problemID, tc.Input, tc.ExpectedOutput, tc.IsHidden,
		)
		tcs = append(tcs, models.Testcase{ProblemID: problemID, Input: tc.Input, ExpectedOutput: tc.ExpectedOutput, IsHidden: tc.IsHidden})
	}
	return tcs
}

type CreateProblemInput struct {
	Title         string
	Slug          string
	Statement     string
	InputFormat   string
	OutputFormat  string
	Note          string
	Difficulty    string
	Tags          []string
	TimeLimitMs   int
	MemoryLimitMb int
	CreatedBy     int
	Testcases     []CreateTestcaseInput
}

type CreateTestcaseInput struct {
	Input          string `json:"input"`
	ExpectedOutput string `json:"expectedOutput"`
	IsHidden       bool   `json:"isHidden"`
}

func CreateProblem(in CreateProblemInput) (*models.Problem, error) {
	p := models.Problem{
		Title:         in.Title,
		Slug:          in.Slug,
		Statement:     in.Statement,
		InputFormat:   in.InputFormat,
		OutputFormat:  in.OutputFormat,
		Note:          in.Note,
		Difficulty:    in.Difficulty,
		Tags:          pq.StringArray(in.Tags),
		TimeLimitMs:   in.TimeLimitMs,
		MemoryLimitMb: in.MemoryLimitMb,
		CreatedBy:     &in.CreatedBy,
	}
	if err := db.DB.Create(&p).Error; err != nil {
		return nil, err
	}
	tcs := insertTestcases(p.ID, in.Testcases)
	p.Testcases = tcs
	return &p, nil
}
