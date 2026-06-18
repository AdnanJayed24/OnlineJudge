package lib

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"onlinejudge/internal/config"
)

var SupportedLanguages = []string{"python", "cpp", "c", "java", "javascript"}

type pistonLang struct {
	Language string
	Version  string
	Filename string
}

var pistonMap = map[string]pistonLang{
	"python":     {Language: "python", Version: "*", Filename: "main.py"},
	"cpp":        {Language: "c++", Version: "*", Filename: "main.cpp"},
	"c":          {Language: "c", Version: "*", Filename: "main.c"},
	"java":       {Language: "java", Version: "*", Filename: "Main.java"},
	"javascript": {Language: "javascript", Version: "*", Filename: "main.js"},
}

type PistonResult struct {
	Stdout           string
	Stderr           string
	ExitCode         int
	CompilationError bool
	TimedOut         bool
}

func PistonRun(language, sourceCode, stdin string, timeLimitMs int) (*PistonResult, error) {
	lang, ok := pistonMap[language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", language)
	}
	if timeLimitMs <= 0 {
		timeLimitMs = 5000
	}

	payload := map[string]interface{}{
		"language":    lang.Language,
		"version":     lang.Version,
		"files":       []map[string]string{{"name": lang.Filename, "content": sourceCode}},
		"stdin":       stdin,
		"run_timeout": timeLimitMs,
	}
	b, _ := json.Marshal(payload)

	resp, err := http.Post(config.C.PistonURL+"/execute", "application/json", bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("piston request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("piston API error: %d", resp.StatusCode)
	}

	var data struct {
		Run struct {
			Stdout string  `json:"stdout"`
			Stderr string  `json:"stderr"`
			Code   *int    `json:"code"`
			Signal *string `json:"signal"`
		} `json:"run"`
		Compile *struct {
			Stdout string `json:"stdout"`
			Stderr string `json:"stderr"`
			Code   *int   `json:"code"`
		} `json:"compile"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("piston decode error: %w", err)
	}

	compileError := data.Compile != nil && data.Compile.Code != nil && *data.Compile.Code != 0
	timedOut := !compileError && data.Run.Signal != nil && *data.Run.Signal == "SIGKILL" && data.Run.Code == nil

	exitCode := 0
	if data.Run.Code != nil {
		exitCode = *data.Run.Code
	} else {
		exitCode = 1
	}

	stderr := data.Run.Stderr
	if compileError && data.Compile != nil {
		stderr = data.Compile.Stderr
	}

	return &PistonResult{
		Stdout:           data.Run.Stdout,
		Stderr:           stderr,
		ExitCode:         exitCode,
		CompilationError: compileError,
		TimedOut:         timedOut,
	}, nil
}
