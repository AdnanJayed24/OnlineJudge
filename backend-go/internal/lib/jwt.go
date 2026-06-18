package lib

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"onlinejudge/internal/config"
)

type AccessClaims struct {
	Sub  int    `json:"sub"`
	Role string `json:"role"`
	jwt.RegisteredClaims
}

type RefreshClaims struct {
	Sub       int    `json:"sub"`
	SessionID string `json:"sessionId"`
	jwt.RegisteredClaims
}

func SignAccess(sub int, role string) (string, error) {
	claims := AccessClaims{
		Sub:  sub,
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(config.C.JWTAccessSecret))
}

func SignRefresh(sub int, sessionID string) (string, error) {
	claims := RefreshClaims{
		Sub:       sub,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(config.C.JWTRefreshSecret))
}

func VerifyAccess(tokenStr string) (*AccessClaims, error) {
	claims := &AccessClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(config.C.JWTAccessSecret), nil
	})
	return claims, err
}

func VerifyRefresh(tokenStr string) (*RefreshClaims, error) {
	claims := &RefreshClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(config.C.JWTRefreshSecret), nil
	})
	return claims, err
}
