package services

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"onlinejudge/internal/db"
	"onlinejudge/internal/lib"
	"onlinejudge/internal/models"
)

type UserPublic struct {
	ID       int    `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

func Register(email, username, password string) (*UserPublic, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}
	user := models.User{
		Email:        email,
		Username:     username,
		PasswordHash: string(hash),
	}
	if err := db.DB.Create(&user).Error; err != nil {
		return nil, err
	}
	return &UserPublic{ID: user.ID, Email: user.Email, Username: user.Username, Role: user.Role}, nil
}

func Login(email, password string) (accessToken, refreshToken string, user *UserPublic, err error) {
	var u models.User
	if err = db.DB.Where("email = ?", email).First(&u).Error; err != nil {
		return "", "", nil, errors.New("INVALID_CREDENTIALS")
	}
	if err = bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return "", "", nil, errors.New("INVALID_CREDENTIALS")
	}

	sessionID := uuid.New().String()
	refreshToken, err = lib.SignRefresh(u.ID, sessionID)
	if err != nil {
		return
	}
	h := sha256.Sum256([]byte(refreshToken))
	tokenHash := hex.EncodeToString(h[:])

	rt := models.RefreshToken{
		SessionID: sessionID,
		TokenHash: tokenHash,
		UserID:    u.ID,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}
	if err = db.DB.Create(&rt).Error; err != nil {
		return
	}

	accessToken, err = lib.SignAccess(u.ID, u.Role)
	if err != nil {
		return
	}
	user = &UserPublic{ID: u.ID, Email: u.Email, Username: u.Username, Role: u.Role}
	return
}

func Logout(refreshToken string) {
	claims, err := lib.VerifyRefresh(refreshToken)
	if err != nil {
		return
	}
	now := time.Now()
	db.DB.Model(&models.RefreshToken{}).
		Where("session_id = ?", claims.SessionID).
		Update("revoked_at", now)
}

func GetUserByID(id int) (*UserPublic, error) {
	var u models.User
	if err := db.DB.Where("id = ?", id).First(&u).Error; err != nil {
		return nil, err
	}
	return &UserPublic{ID: u.ID, Email: u.Email, Username: u.Username, Role: u.Role}, nil
}
