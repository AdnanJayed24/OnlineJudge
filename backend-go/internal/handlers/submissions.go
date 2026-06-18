package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"onlinejudge/internal/services"
)

func Submit(c *gin.Context) {
	var body struct {
		ProblemID  int    `json:"problemId"`
		Language   string `json:"language"`
		SourceCode string `json:"sourceCode"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	userIDVal, _ := c.Get("userId")
	sub, err := services.CreateSubmission(userIDVal.(int), body.ProblemID, body.Language, body.SourceCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue submission"})
		return
	}
	c.JSON(http.StatusAccepted, sub)
}

func GetSubmission(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	sub, err := services.GetSubmission(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}

	userIDVal, _ := c.Get("userId")
	if sub.UserID != userIDVal.(int) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, sub)
}

func ListSubmissions(c *gin.Context) {
	userIDVal, _ := c.Get("userId")
	userID := userIDVal.(int)

	var problemID int
	if raw := c.Query("problemId"); raw != "" {
		problemID, _ = strconv.Atoi(raw)
	}

	items, err := services.ListSubmissions(userID, problemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list submissions"})
		return
	}
	c.JSON(http.StatusOK, items)
}
