package services

import (
	"fmt"
	"strings"

	"github.com/lib/pq"
	"gorm.io/gorm"
	"onlinejudge/internal/db"
	"onlinejudge/internal/lib"
	"onlinejudge/internal/models"
)

const cfFetchFailed = "<!-- CF_FETCH_FAILED -->"

func isPlaceholder(statement string) bool {
	if statement == cfFetchFailed {
		return false
	}
	return strings.Contains(statement, "View the full problem statement on Codeforces") || len(statement) < 600
}

type ProblemCountJSON struct {
	Submissions int `json:"submissions"`
}

type ProblemListItem struct {
	ID            int              `json:"id"`
	Title         string           `json:"title"`
	Slug          string           `json:"slug"`
	Difficulty    string           `json:"difficulty"`
	Tags          pq.StringArray   `json:"tags"`
	Source        string           `json:"source"`
	CfContestId   *int             `json:"cfContestId"`
	CfIndex       *string          `json:"cfIndex"`
	Rating        *int             `json:"rating"`
	ExternalUrl   *string          `json:"externalUrl"`
	LcFrontendId  *int             `json:"lcFrontendId"`
	TimeLimitMs   int              `json:"timeLimitMs"`
	MemoryLimitMb int              `json:"memoryLimitMb"`
	Count         ProblemCountJSON `json:"_count"`
	Solved        bool             `json:"solved"`
}

type problemWithCount struct {
	models.Problem
	SubmissionCount int `gorm:"column:submission_count"`
}

func ListProblems(userID int, source, q string) ([]ProblemListItem, error) {
	query := db.DB.Table("problems").
		Select("problems.*, (SELECT COUNT(*) FROM submissions WHERE submissions.problem_id = problems.id) as submission_count")

	if source != "" && source != "all" {
		query = query.Where("source = ?", source)
	}
	if q = strings.TrimSpace(q); q != "" {
		query = query.Where("title ILIKE ? OR ? = ANY(tags)", "%"+q+"%", strings.ToLower(q))
	}

	var rows []problemWithCount
	if err := query.Order("id ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}

	solvedSet := map[int]bool{}
	if userID > 0 {
		var solved []struct{ ProblemID int `gorm:"column:problem_id"` }
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
			Source:        r.Source,
			CfContestId:   r.CfContestId,
			CfIndex:       r.CfIndex,
			Rating:        r.Rating,
			ExternalUrl:   r.ExternalUrl,
			LcFrontendId:  r.LcFrontendId,
			TimeLimitMs:   r.TimeLimitMs,
			MemoryLimitMb: r.MemoryLimitMb,
			Count:         ProblemCountJSON{Submissions: r.SubmissionCount},
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
	if err != nil {
		return nil, err
	}

	if p.Source == "codeforces" && p.CfContestId != nil && p.CfIndex != nil && isPlaceholder(p.Statement) {
		html, _ := lib.CFAuthGet(fmt.Sprintf("/contest/%d/problem/%s", *p.CfContestId, *p.CfIndex))
		if html == "" || !strings.Contains(html, "problem-statement") {
			html, _ = lib.CFAuthGet(fmt.Sprintf("/problemset/problem/%d/%s", *p.CfContestId, *p.CfIndex))
		}
		newStatement := cfFetchFailed
		if extracted := extractCFStatement(html); len(extracted) >= 600 {
			newStatement = extracted
		}
		db.DB.Model(&p).Update("statement", newStatement)
		p.Statement = newStatement
	}

	return &p, nil
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
	tcs := make([]models.Testcase, len(in.Testcases))
	for i, tc := range in.Testcases {
		tcs[i] = models.Testcase{Input: tc.Input, ExpectedOutput: tc.ExpectedOutput, IsHidden: tc.IsHidden}
	}
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
		Source:        "local",
		CreatedBy:     &in.CreatedBy,
		Testcases:     tcs,
	}
	if err := db.DB.Create(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func extractCFStatement(html string) string {
	if html == "" {
		return ""
	}
	classSearch := `class="problem-statement"`
	classIdx := strings.Index(html, classSearch)
	if classIdx == -1 {
		return ""
	}
	divStart := classIdx
	for divStart > 0 && html[divStart] != '<' {
		divStart--
	}

	depth := 0
	i := divStart
	for i < len(html) {
		if html[i] == '<' {
			if strings.HasPrefix(html[i:], "<div") && i+4 < len(html) {
				next := html[i+4]
				if next == ' ' || next == '>' {
					depth++
					i += 4
					continue
				}
			}
			if strings.HasPrefix(html[i:], "</div>") {
				depth--
				if depth == 0 {
					out := html[divStart : i+6]
					out = strings.ReplaceAll(out, `src="/predownloaded/`, `src="https://codeforces.com/predownloaded/`)
					out = strings.ReplaceAll(out, `src="/espresso/`, `src="https://codeforces.com/espresso/`)
					return out
				}
				i += 6
				continue
			}
		}
		i++
	}
	return ""
}
