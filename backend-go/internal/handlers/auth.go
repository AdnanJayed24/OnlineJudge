package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"onlinejudge/internal/db"
	"onlinejudge/internal/lib"
	"onlinejudge/internal/models"
	"onlinejudge/internal/services"
)

func Register(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	user, err := services.Register(body.Email, body.Username, body.Password)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Email or username already taken"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "registration failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"user": user})
}

func Login(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	accessToken, refreshToken, user, err := services.Login(body.Email, body.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("access_token", accessToken, 900, "/", "", false, true)
	c.SetCookie("refresh_token", refreshToken, 604800, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func Logout(c *gin.Context) {
	token, _ := c.Cookie("refresh_token")
	if token != "" {
		services.Logout(token)
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("access_token", "", -1, "/", "", false, true)
	c.SetCookie("refresh_token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func Me(c *gin.Context) {
	userIDVal, _ := c.Get("userId")
	userID := userIDVal.(int)
	user, err := services.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func Refresh(c *gin.Context) {
	token, err := c.Cookie("refresh_token")
	if err != nil || token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No refresh token"})
		return
	}

	claims, err := lib.VerifyRefresh(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}

	h := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(h[:])

	var stored models.RefreshToken
	if err := db.DB.Where("token_hash = ?", tokenHash).First(&stored).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token invalid or expired"})
		return
	}
	if stored.RevokedAt != nil || stored.ExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token invalid or expired"})
		return
	}

	var user models.User
	if err := db.DB.Where("id = ?", stored.UserID).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	_ = claims // sessionId already validated via tokenHash lookup
	accessToken, err := lib.SignAccess(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sign token"})
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("access_token", accessToken, 900, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
