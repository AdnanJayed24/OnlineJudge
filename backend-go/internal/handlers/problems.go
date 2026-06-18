package handlers

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"onlinejudge/internal/services"
)

func ListProblems(c *gin.Context) {
	var userID int
	if v, ok := c.Get("userId"); ok {
		userID = v.(int)
	}
	source := c.Query("source")
	q := c.Query("q")

	problems, err := services.ListProblems(userID, source, q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch problems"})
		return
	}
	c.JSON(http.StatusOK, problems)
}

func GetProblem(c *gin.Context) {
	slug := c.Param("slug")
	problem, err := services.GetProblem(slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Problem not found"})
		return
	}
	c.JSON(http.StatusOK, problem)
}

func CreateProblem(c *gin.Context) {
	roleVal, _ := c.Get("userRole")
	if roleVal.(string) != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	var body struct {
		Title         string                         `json:"title"`
		Slug          string                         `json:"slug"`
		Statement     string                         `json:"statement"`
		InputFormat   string                         `json:"inputFormat"`
		OutputFormat  string                         `json:"outputFormat"`
		Note          string                         `json:"note"`
		Difficulty    string                         `json:"difficulty"`
		Tags          []string                       `json:"tags"`
		TimeLimitMs   int                            `json:"timeLimitMs"`
		MemoryLimitMb int                            `json:"memoryLimitMb"`
		Testcases     []services.CreateTestcaseInput `json:"testcases"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	userIDVal, _ := c.Get("userId")
	problem, err := services.CreateProblem(services.CreateProblemInput{
		Title:         body.Title,
		Slug:          body.Slug,
		Statement:     body.Statement,
		InputFormat:   body.InputFormat,
		OutputFormat:  body.OutputFormat,
		Note:          body.Note,
		Difficulty:    body.Difficulty,
		Tags:          body.Tags,
		TimeLimitMs:   body.TimeLimitMs,
		MemoryLimitMb: body.MemoryLimitMb,
		CreatedBy:     userIDVal.(int),
		Testcases:     body.Testcases,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create problem"})
		return
	}
	c.JSON(http.StatusCreated, problem)
}

var cfProblemIDRe = regexp.MustCompile(`^(\d+)([A-Za-z]+\d*)$`)

func FetchProblem(c *gin.Context) {
	roleVal, _ := c.Get("userRole")
	if roleVal.(string) != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	var body struct {
		Platform  string `json:"platform"`
		ProblemID string `json:"problemId"`
		ContestID *int   `json:"contestId"`
		Index     string `json:"index"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	switch body.Platform {
	case "codeforces":
		var contestID int
		var index string
		if body.ProblemID != "" {
			m := cfProblemIDRe.FindStringSubmatch(strings.TrimSpace(body.ProblemID))
			if m == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": `Invalid CF problem ID. Use format like "1A".`})
				return
			}
			contestID, _ = strconv.Atoi(m[1])
			index = strings.ToUpper(m[2])
		} else if body.ContestID != nil && body.Index != "" {
			contestID = *body.ContestID
			index = strings.ToUpper(body.Index)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": `Provide problemId (e.g. "1A") or contestId + index`})
			return
		}
		result, err := services.SyncCFProblem(contestID, index)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, result)

	case "leetcode":
		if body.ProblemID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "problemId required"})
			return
		}
		lcID := strings.TrimSpace(body.ProblemID)
		asNum, err := strconv.Atoi(lcID)
		var result map[string]interface{}
		if err == nil {
			result, err = services.SyncLCProblemByID(asNum)
		} else {
			result, err = services.SyncLCProblem(lcID)
		}
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, result)

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": `platform must be "codeforces" or "leetcode"`})
	}
}
