package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"onlinejudge/internal/services"
)

func ListProblems(c *gin.Context) {
	var userID int
	if v, ok := c.Get("userId"); ok {
		userID = v.(int)
	}
	problems, err := services.ListProblems(userID, c.Query("source"), c.Query("q"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch problems"})
		return
	}
	c.JSON(http.StatusOK, problems)
}

func GetProblem(c *gin.Context) {
	problem, err := services.GetProblem(c.Param("slug"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Problem not found"})
		return
	}
	c.JSON(http.StatusOK, problem)
}

func DeleteProblem(c *gin.Context) {
	roleVal, _ := c.Get("userRole")
	if roleVal.(string) != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}
	if err := services.DeleteProblem(c.Param("slug")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Problem not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
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
