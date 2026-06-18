package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"onlinejudge/internal/lib"
)

func Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie("access_token")
		if err != nil || token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}
		claims, err := lib.VerifyAccess(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}
		c.Set("userId", claims.Sub)
		c.Set("userRole", claims.Role)
		c.Next()
	}
}

func OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie("access_token")
		if err != nil || token == "" {
			c.Next()
			return
		}
		claims, err := lib.VerifyAccess(token)
		if err != nil {
			c.Next()
			return
		}
		c.Set("userId", claims.Sub)
		c.Set("userRole", claims.Role)
		c.Next()
	}
}
