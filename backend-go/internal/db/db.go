package db

import (
	"log"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"onlinejudge/internal/config"
	"onlinejudge/internal/models"
)

var DB *gorm.DB

func Init() {
	var err error
	DB, err = gorm.Open(postgres.Open(config.C.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("[db] failed to connect: %v", err)
	}
	log.Println("[db] connected")

	if err := DB.AutoMigrate(
		&models.User{},
		&models.Problem{},
		&models.Submission{},
		&models.Testcase{},
		&models.SubmissionResult{},
		&models.RefreshToken{},
	); err != nil {
		log.Fatalf("[db] automigrate failed: %v", err)
	}
	log.Println("[db] schema up to date")

	seedAdmin()
}

func seedAdmin() {
	const email = "adnanjayed6399@gmail.com"

	var existing models.User
	if err := DB.Where("email = ?", email).First(&existing).Error; err == nil {
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("666666"), 12)
	if err != nil {
		log.Printf("[db] seed admin: failed to hash password: %v", err)
		return
	}

	admin := models.User{
		Email:        email,
		Username:     "adnanjayed",
		PasswordHash: string(hash),
		Role:         "admin",
	}
	if err := DB.Create(&admin).Error; err != nil {
		log.Printf("[db] seed admin: failed to create admin: %v", err)
		return
	}
	log.Println("[db] admin account seeded")
}
