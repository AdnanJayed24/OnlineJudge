package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/lib/pq"
	"onlinejudge/internal/db"
	"onlinejudge/internal/models"
)

const lcGraphQL = "https://leetcode.com/graphql"

type lcQuestion struct {
	QuestionFrontendID string `json:"questionFrontendId"`
	Title              string `json:"title"`
	TitleSlug          string `json:"titleSlug"`
	Difficulty         string `json:"difficulty"`
	Content            string `json:"content"`
	TopicTags          []struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	} `json:"topicTags"`
}

const lcQuery = `query q($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title titleSlug difficulty content
    topicTags { name slug }
  }
}`

func lcDifficulty(d string) string {
	switch strings.ToLower(d) {
	case "easy":
		return "easy"
	case "hard":
		return "hard"
	default:
		return "medium"
	}
}

// SyncLCProblem fetches and upserts a LeetCode problem by title slug.
func SyncLCProblem(titleSlug string) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"query":     lcQuery,
		"variables": map[string]string{"titleSlug": titleSlug},
	}
	b, _ := json.Marshal(payload)

	req, _ := http.NewRequest(http.MethodPost, lcGraphQL, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Referer", "https://leetcode.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("LeetCode request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LeetCode API error: %d", resp.StatusCode)
	}

	var data struct {
		Data struct {
			Question *lcQuestion `json:"question"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("LeetCode decode error: %w", err)
	}
	q := data.Data.Question
	if q == nil || q.Content == "" {
		return nil, fmt.Errorf("problem not found on LeetCode: %s", titleSlug)
	}

	return upsertLCProblem(q)
}

// SyncLCProblemByID fetches a LeetCode problem by its numeric frontend ID.
func SyncLCProblemByID(id int) (map[string]interface{}, error) {
	resp, err := http.Get("https://leetcode.com/api/problems/all/")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch LeetCode problem list: %w", err)
	}
	defer resp.Body.Close()

	var data struct {
		StatStatusPairs []struct {
			Stat struct {
				QuestionID        int    `json:"question_id"`
				QuestionTitleSlug string `json:"question__title_slug"`
			} `json:"stat"`
		} `json:"stat_status_pairs"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode LeetCode problem list: %w", err)
	}

	for _, pair := range data.StatStatusPairs {
		if pair.Stat.QuestionID == id {
			return SyncLCProblem(pair.Stat.QuestionTitleSlug)
		}
	}
	return nil, fmt.Errorf("LeetCode problem #%d not found", id)
}

func upsertLCProblem(q *lcQuestion) (map[string]interface{}, error) {
	var frontendID int
	fmt.Sscanf(q.QuestionFrontendID, "%d", &frontendID)

	slug := fmt.Sprintf("lc-%s", q.QuestionFrontendID)
	difficulty := lcDifficulty(q.Difficulty)
	tags := make([]string, len(q.TopicTags))
	for i, t := range q.TopicTags {
		tags[i] = t.Name
	}
	extURL := fmt.Sprintf("https://leetcode.com/problems/%s/", q.TitleSlug)

	var existing models.Problem
	result := db.DB.Where("slug = ?", slug).First(&existing)
	if result.Error != nil {
		p := models.Problem{
			Slug:         slug,
			Title:        q.Title,
			Statement:    q.Content,
			Difficulty:   difficulty,
			Tags:         pq.StringArray(tags),
			Source:       "leetcode",
			ExternalUrl:  &extURL,
			LcSlug:       &q.TitleSlug,
			LcFrontendId: &frontendID,
		}
		if err := db.DB.Create(&p).Error; err != nil {
			return nil, err
		}
	} else {
		if err := db.DB.Model(&existing).Updates(map[string]interface{}{
			"title":      q.Title,
			"difficulty": difficulty,
			"tags":       pq.StringArray(tags),
			"statement":  q.Content,
			"external_url": extURL,
		}).Error; err != nil {
			return nil, err
		}
	}

	return map[string]interface{}{
		"slug":       slug,
		"title":      q.Title,
		"difficulty": difficulty,
		"frontendId": frontendID,
	}, nil
}
