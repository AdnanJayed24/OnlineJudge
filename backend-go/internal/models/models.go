package models

import (
	"time"

	"github.com/lib/pq"
	"gorm.io/datatypes"
)

type User struct {
	ID           int       `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Email        string    `gorm:"column:email;uniqueIndex"           json:"email"`
	Username     string    `gorm:"column:username;uniqueIndex"        json:"username"`
	PasswordHash string    `gorm:"column:password_hash"               json:"-"`
	Role         string    `gorm:"column:role;default:user"           json:"role"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime"   json:"createdAt"`
}

func (User) TableName() string { return "users" }

type Problem struct {
	ID            int            `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Title         string         `gorm:"column:title"                       json:"title"`
	Slug          string         `gorm:"column:slug;uniqueIndex"            json:"slug"`
	Statement     string         `gorm:"column:statement"                   json:"statement"`
	InputFormat   string         `gorm:"column:input_format;default:''"     json:"inputFormat"`
	OutputFormat  string         `gorm:"column:output_format;default:''"    json:"outputFormat"`
	Note          string         `gorm:"column:note;default:''"             json:"note"`
	Difficulty    string         `gorm:"column:difficulty;default:medium"   json:"difficulty"`
	Tags          pq.StringArray `gorm:"column:tags;type:text[]"            json:"tags"`
	TimeLimitMs   int            `gorm:"column:time_limit_ms;default:2000"  json:"timeLimitMs"`
	MemoryLimitMb int            `gorm:"column:memory_limit_mb;default:256" json:"memoryLimitMb"`
	CreatedBy     *int           `gorm:"column:created_by"                  json:"createdBy,omitempty"`
	CreatedAt     time.Time      `gorm:"column:created_at;autoCreateTime"   json:"createdAt"`
	Testcases     []Testcase     `gorm:"foreignKey:ProblemID"               json:"testcases,omitempty"`
}

func (Problem) TableName() string { return "problems" }

type Testcase struct {
	ID             int       `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ProblemID      int       `gorm:"column:problem_id;index"            json:"problemId,omitempty"`
	Input          string    `gorm:"column:input"                       json:"input"`
	ExpectedOutput string    `gorm:"column:expected_output"             json:"expectedOutput,omitempty"`
	IsHidden       bool      `gorm:"column:is_hidden;default:true"      json:"isHidden"`
	CreatedAt      time.Time `gorm:"column:created_at;autoCreateTime"   json:"createdAt,omitempty"`
}

func (Testcase) TableName() string { return "testcases" }

type Submission struct {
	ID         int               `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID     int               `gorm:"column:user_id;index"               json:"userId"`
	ProblemID  int               `gorm:"column:problem_id;index"            json:"problemId"`
	Language   string            `gorm:"column:language"                    json:"language"`
	SourceCode string            `gorm:"column:source_code"                 json:"sourceCode"`
	Status     string            `gorm:"column:status;default:QUEUED"       json:"status"`
	CreatedAt  time.Time         `gorm:"column:created_at;autoCreateTime"   json:"createdAt"`
	Problem    *Problem          `gorm:"foreignKey:ProblemID"               json:"problem,omitempty"`
	Result     *SubmissionResult `gorm:"foreignKey:SubmissionID"            json:"result"`
}

func (Submission) TableName() string { return "submissions" }

type SubmissionResult struct {
	ID           int            `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	SubmissionID int            `gorm:"column:submission_id;uniqueIndex"   json:"submissionId"`
	Verdict      string         `gorm:"column:verdict"                     json:"verdict"`
	RuntimeMs    *int           `gorm:"column:runtime_ms"                  json:"runtimeMs"`
	DetailsJson  datatypes.JSON `gorm:"column:details_json;type:jsonb"     json:"detailsJson"`
	CreatedAt    time.Time      `gorm:"column:created_at;autoCreateTime"   json:"createdAt"`
}

func (SubmissionResult) TableName() string { return "submission_results" }

type RefreshToken struct {
	ID        int        `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	SessionID string     `gorm:"column:session_id;uniqueIndex"      json:"sessionId"`
	TokenHash string     `gorm:"column:token_hash;uniqueIndex"      json:"-"`
	UserID    int        `gorm:"column:user_id;index"               json:"userId"`
	ExpiresAt time.Time  `gorm:"column:expires_at"                  json:"expiresAt"`
	RevokedAt *time.Time `gorm:"column:revoked_at"                  json:"revokedAt"`
	CreatedAt time.Time  `gorm:"column:created_at;autoCreateTime"   json:"createdAt"`
}

func (RefreshToken) TableName() string { return "refresh_tokens" }
