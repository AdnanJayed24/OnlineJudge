package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"onlinejudge/internal/lib"
)

func RunCode(c *gin.Context) {
	var body struct {
		Language   string `json:"language"`
		SourceCode string `json:"sourceCode"`
		Stdin      string `json:"stdin"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	result, err := lib.PistonRun(body.Language, body.SourceCode, body.Stdin, 5000)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"stdout":           result.Stdout,
		"stderr":           result.Stderr,
		"exitCode":         result.ExitCode,
		"compilationError": result.CompilationError,
	})
}
