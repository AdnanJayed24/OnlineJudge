package judge

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Result struct {
	Stdout           string
	Stderr           string
	ExitCode         int
	CompilationError bool
	TimedOut         bool
	RuntimeMs        int
}

var langConfigs = map[string]struct {
	image      string
	srcFile    string
	compileCmd string
	runCmd     string
}{
	"cpp":        {"gcc:13", "main.cpp", "g++ -O2 -o /sandbox/exe /sandbox/main.cpp", "/sandbox/exe"},
	"c":          {"gcc:13", "main.c", "gcc -O2 -o /sandbox/exe /sandbox/main.c", "/sandbox/exe"},
	"python":     {"python:3.12-alpine", "main.py", "", "python3 /sandbox/main.py"},
	"java":       {"openjdk:21-slim", "Main.java", "javac -d /sandbox /sandbox/Main.java", "java -cp /sandbox Main"},
	"javascript": {"node:20-alpine", "main.js", "", "node /sandbox/main.js"},
}

func Run(language, sourceCode, stdin string, timeLimitMs, memMb int) (*Result, error) {
	cfg, ok := langConfigs[language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", language)
	}

	dir, err := os.MkdirTemp("", "oj_*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)

	if err := os.WriteFile(filepath.Join(dir, cfg.srcFile), []byte(sourceCode), 0644); err != nil {
		return nil, err
	}

	// Compile phase (compiled languages only)
	if cfg.compileCmd != "" {
		out, err := dockerExec(cfg.image, dir, cfg.compileCmd, "", 30*time.Second, 512)
		if err != nil || out.ExitCode != 0 {
			stderr := out.Stderr
			if err != nil {
				stderr = err.Error()
			}
			return &Result{Stderr: stderr, ExitCode: 1, CompilationError: true}, nil
		}
	}

	// Run phase — write start time before program, read it after via a file in /sandbox
	timeSecs := timeLimitMs/1000 + 1
	// Script: record epoch-ms before and after the program, save diff to /sandbox/.ms
	runScript := fmt.Sprintf(
		"S=$(date +%%s%%3N) 2>/dev/null || S=$(date +%%s)000; timeout %d %s; C=$?; E=$(date +%%s%%3N) 2>/dev/null || E=$(date +%%s)000; echo $((E-S)) > /sandbox/.ms; exit $C",
		timeSecs, cfg.runCmd,
	)
	runTimeout := time.Duration(timeLimitMs)*time.Millisecond + 10*time.Second

	out, err := dockerExec(cfg.image, dir, runScript, stdin, runTimeout, memMb)
	if err != nil {
		return &Result{Stderr: err.Error(), ExitCode: 1}, nil
	}

	// Read actual program runtime written by the script
	runtimeMs := 0
	if data, readErr := os.ReadFile(filepath.Join(dir, ".ms")); readErr == nil {
		runtimeMs, _ = strconv.Atoi(strings.TrimSpace(string(data)))
	}

	return &Result{
		Stdout:    out.Stdout,
		Stderr:    out.Stderr,
		ExitCode:  out.ExitCode,
		TimedOut:  out.ExitCode == 124,
		RuntimeMs: runtimeMs,
	}, nil
}

type execOut struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

func dockerExec(image, dir, script, stdin string, timeout time.Duration, memMb int) (*execOut, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "run", "--rm", "-i",
		"--memory", fmt.Sprintf("%dm", memMb),
		"--cpus", "0.5",
		"--network", "none",
		"--pids-limit", "50",
		"-v", dir+":/sandbox",
		image,
		"sh", "-c", script,
	)
	cmd.Stdin = strings.NewReader(stdin)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			exitCode = ee.ExitCode()
		} else {
			return &execOut{Stderr: stderr.String()}, err
		}
	}

	return &execOut{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: exitCode,
	}, nil
}
