package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/lib/pq"
	"onlinejudge/internal/db"
	"onlinejudge/internal/lib"
	"onlinejudge/internal/models"
)

const cfAPI = "https://codeforces.com/api"

type cfProblem struct {
	ContestID int      `json:"contestId"`
	Index     string   `json:"index"`
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	Rating    *int     `json:"rating"`
	Tags      []string `json:"tags"`
}

type cfProblemsetResp struct {
	Status string `json:"status"`
	Result struct {
		Problems []cfProblem `json:"problems"`
	} `json:"result"`
}

type SyncResult struct {
	Synced   int                                       `json:"synced"`
	Skipped  int                                       `json:"skipped"`
	Problems []map[string]string                       `json:"problems"`
}

func cfRatingToDifficulty(r *int) string {
	if r == nil {
		return "medium"
	}
	if *r <= 1300 {
		return "easy"
	}
	if *r <= 2000 {
		return "medium"
	}
	return "hard"
}

func cfSlug(contestID int, index string) string {
	return fmt.Sprintf("cf-%d%s", contestID, strings.ToLower(index))
}

func cfPlaceholder(contestID int, index string, rating *int) string {
	url := fmt.Sprintf("https://codeforces.com/contest/%d/problem/%s", contestID, index)
	parts := []string{
		fmt.Sprintf(`<p><strong>Source:</strong> Codeforces — Problem %d%s</p>`, contestID, index),
	}
	if rating != nil {
		parts = append(parts, fmt.Sprintf(`<p><strong>Rating:</strong> %d</p>`, *rating))
	}
	parts = append(parts, fmt.Sprintf(`<p>View the full problem statement on Codeforces: <a href="%s" target="_blank">%s</a></p>`, url, url))
	return strings.Join(parts, "\n")
}

func fetchCFProblemset() ([]cfProblem, error) {
	resp, err := http.Get(cfAPI + "/problemset.problems")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var data cfProblemsetResp
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Status != "OK" {
		return nil, fmt.Errorf("CF API error: %s", data.Status)
	}
	return data.Result.Problems, nil
}

// SyncCFProblem syncs a single Codeforces problem by contest+index.
func SyncCFProblem(contestID int, index string) (map[string]string, error) {
	problems, err := fetchCFProblemset()
	if err != nil {
		return nil, err
	}

	upper := strings.ToUpper(index)
	var found *cfProblem
	for i := range problems {
		if problems[i].ContestID == contestID && strings.ToUpper(problems[i].Index) == upper && problems[i].Type == "PROGRAMMING" {
			found = &problems[i]
			break
		}
	}
	if found == nil {
		return nil, fmt.Errorf("problem %d%s not found on Codeforces", contestID, index)
	}

	slug := cfSlug(contestID, index)
	difficulty := cfRatingToDifficulty(found.Rating)
	extURL := fmt.Sprintf("https://codeforces.com/contest/%d/problem/%s", contestID, index)

	html, _ := lib.CFAuthGet(fmt.Sprintf("/contest/%d/problem/%s", contestID, index))
	statement := ""
	if extracted := extractCFStatement(html); len(extracted) >= 600 {
		statement = extracted
	}

	if err := upsertCFProblem(found, slug, difficulty, extURL, statement); err != nil {
		return nil, err
	}
	return map[string]string{"slug": slug, "title": found.Name, "difficulty": difficulty}, nil
}

// SyncByContest syncs all problems in a Codeforces contest.
func SyncByContest(contestID int) (*SyncResult, error) {
	problems, err := fetchCFProblemset()
	if err != nil {
		return nil, err
	}
	var filtered []cfProblem
	for _, p := range problems {
		if p.ContestID == contestID && p.Type == "PROGRAMMING" {
			filtered = append(filtered, p)
		}
	}
	if len(filtered) == 0 {
		return nil, fmt.Errorf("no problems found for contest %d", contestID)
	}
	return upsertCFProblems(filtered)
}

// SyncByProblemset syncs problems from the Codeforces problemset with optional filters.
func SyncByProblemset(tags []string, minRating, maxRating, limit int) (*SyncResult, error) {
	url := cfAPI + "/problemset.problems"
	if len(tags) > 0 {
		url += "?tags=" + strings.Join(tags, ";")
	}

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var data cfProblemsetResp
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Status != "OK" {
		return nil, fmt.Errorf("CF API error: %s", data.Status)
	}

	problems := data.Result.Problems
	var filtered []cfProblem
	for _, p := range problems {
		if p.Type != "PROGRAMMING" {
			continue
		}
		if minRating > 0 && (p.Rating == nil || *p.Rating < minRating) {
			continue
		}
		if maxRating > 0 && (p.Rating == nil || *p.Rating > maxRating) {
			continue
		}
		filtered = append(filtered, p)
	}

	cap := 50
	if limit > 0 && limit < 200 {
		cap = limit
	}
	if len(filtered) > cap {
		filtered = filtered[:cap]
	}
	return upsertCFProblems(filtered)
}

func upsertCFProblem(p *cfProblem, slug, difficulty, extURL, statement string) error {
	tags := pq.StringArray(p.Tags)
	if tags == nil {
		tags = pq.StringArray{}
	}

	var existing models.Problem
	result := db.DB.Where("slug = ?", slug).First(&existing)
	if result.Error != nil {
		prob := models.Problem{
			Slug:        slug,
			Title:       p.Name,
			Statement:   statement,
			Difficulty:  difficulty,
			Tags:        tags,
			Source:      "codeforces",
			CfContestId: &p.ContestID,
			CfIndex:     &p.Index,
			Rating:      p.Rating,
			ExternalUrl: &extURL,
		}
		return db.DB.Create(&prob).Error
	}
	return db.DB.Model(&existing).Updates(map[string]interface{}{
		"title":       p.Name,
		"difficulty":  difficulty,
		"tags":        tags,
		"rating":      p.Rating,
		"external_url": extURL,
	}).Error
}

func upsertCFProblems(problems []cfProblem) (*SyncResult, error) {
	res := &SyncResult{Problems: []map[string]string{}}
	for _, p := range problems {
		if p.ContestID == 0 || p.Index == "" || p.Name == "" {
			res.Skipped++
			continue
		}
		slug := cfSlug(p.ContestID, p.Index)
		difficulty := cfRatingToDifficulty(p.Rating)
		extURL := fmt.Sprintf("https://codeforces.com/contest/%d/problem/%s", p.ContestID, p.Index)
		statement := cfPlaceholder(p.ContestID, p.Index, p.Rating)

		if err := upsertCFProblem(&p, slug, difficulty, extURL, statement); err != nil {
			res.Skipped++
			continue
		}
		res.Synced++
		res.Problems = append(res.Problems, map[string]string{
			"title":      p.Name,
			"slug":       slug,
			"difficulty": difficulty,
		})
	}
	return res, nil
}
