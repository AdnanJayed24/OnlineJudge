package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"onlinejudge/internal/services"
)

func SyncContest(c *gin.Context) {
	roleVal, _ := c.Get("userRole")
	if roleVal.(string) != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	var body struct {
		ContestID int `json:"contestId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.ContestID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "contestId required"})
		return
	}

	result, err := services.SyncByContest(body.ContestID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func SyncProblemset(c *gin.Context) {
	roleVal, _ := c.Get("userRole")
	if roleVal.(string) != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	var body struct {
		Tags      []string `json:"tags"`
		MinRating int      `json:"minRating"`
		MaxRating int      `json:"maxRating"`
		Limit     int      `json:"limit"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	result, err := services.SyncByProblemset(body.Tags, body.MinRating, body.MaxRating, body.Limit)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
