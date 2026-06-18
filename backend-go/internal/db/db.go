package db

import (
	"log"

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
}
