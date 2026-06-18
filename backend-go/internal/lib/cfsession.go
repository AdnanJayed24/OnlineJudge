package lib

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"onlinejudge/internal/config"
)

const cfBase = "https://codeforces.com"

var CFLangIDs = map[string]int{
	"python":     71,
	"cpp":        73,
	"c":          43,
	"java":       87,
	"javascript": 55,
}

var (
	cfJar          = make(map[string]string)
	cfSessionReady bool
	cfMu           sync.Mutex
)

var cfHTTPClient = &http.Client{
	CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	},
	Timeout: 30 * time.Second,
}

func parseCFCookies(resp *http.Response) {
	for _, c := range resp.Cookies() {
		cfJar[c.Name] = c.Value
	}
}

func cfCookieHeader() string {
	parts := make([]string, 0, len(cfJar))
	for k, v := range cfJar {
		parts = append(parts, k+"="+v)
	}
	return strings.Join(parts, "; ")
}

func loadCookieString(raw string) {
	for _, part := range strings.Split(raw, ";") {
		part = strings.TrimSpace(part)
		eq := strings.IndexByte(part, '=')
		if eq == -1 {
			continue
		}
		cfJar[strings.TrimSpace(part[:eq])] = strings.TrimSpace(part[eq+1:])
	}
}

var csrfRe = regexp.MustCompile(`name="X-Csrf-Token"\s+content="([^"]+)"`)

func extractCFCSRF(html string) (string, error) {
	m := csrfRe.FindStringSubmatch(html)
	if m == nil {
		return "", fmt.Errorf("[CF] CSRF token not found in page")
	}
	return m[1], nil
}

func calcTta(csrf string) int {
	tta := 0
	for i, ch := range csrf {
		tta += (i + 1) * int(ch)
	}
	return tta
}

func cfGet(path string) (*http.Response, string, error) {
	req, err := http.NewRequest(http.MethodGet, cfBase+path, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124")
	req.Header.Set("Cookie", cfCookieHeader())

	resp, err := cfHTTPClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	parseCFCookies(resp)
	b, _ := io.ReadAll(resp.Body)
	return resp, string(b), nil
}

func cfPost(path string, body url.Values, referer string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodPost, cfBase+path, strings.NewReader(body.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Referer", cfBase+referer)
	req.Header.Set("Cookie", cfCookieHeader())

	resp, err := cfHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	parseCFCookies(resp)
	resp.Body.Close()
	return resp, nil
}

func cfLogin() error {
	if config.C.CFEmail == "" || config.C.CFPassword == "" {
		return fmt.Errorf("[CF] set CF_EMAIL + CF_PASSWORD (or CF_COOKIE) to judge CF problems")
	}
	_, html, err := cfGet("/enter")
	if err != nil {
		return err
	}
	csrf, err := extractCFCSRF(html)
	if err != nil {
		return err
	}

	body := url.Values{
		"csrf_token":    {csrf},
		"action":        {"enter"},
		"handleOrEmail": {config.C.CFEmail},
		"password":      {config.C.CFPassword},
		"_tta":          {fmt.Sprintf("%d", calcTta(csrf))},
		"remember":      {"on"},
	}
	resp, err := cfPost("/enter", body, "/enter")
	if err != nil {
		return err
	}

	location := resp.Header.Get("Location")
	if location == "" || strings.Contains(location, "/enter") {
		return fmt.Errorf("[CF] login failed — wrong email/password")
	}
	cfSessionReady = true
	return nil
}

func EnsureCFSession() error {
	cfMu.Lock()
	defer cfMu.Unlock()
	if cfSessionReady {
		return nil
	}
	if config.C.CFCookie != "" {
		loadCookieString(config.C.CFCookie)
		cfSessionReady = true
		return nil
	}
	return cfLogin()
}

func InvalidateCFSession() {
	cfMu.Lock()
	cfSessionReady = false
	cfMu.Unlock()
}

// CFAuthGet fetches a CF page using the authenticated session.
func CFAuthGet(path string) (string, error) {
	if err := EnsureCFSession(); err != nil {
		return "", err
	}
	_, html, err := cfGet(path)
	return html, err
}

// CFSubmitParams holds the parameters for a Codeforces submission.
type CFSubmitParams struct {
	ContestID    int
	ProblemIndex string
	Language     string
	SourceCode   string
}

// SubmitToCodeforces submits code to a Codeforces contest.
func SubmitToCodeforces(p CFSubmitParams) error {
	langID, ok := CFLangIDs[p.Language]
	if !ok {
		return fmt.Errorf("[CF] unsupported language: %s", p.Language)
	}

	submitPath := fmt.Sprintf("/contest/%d/submit", p.ContestID)
	_, html, err := cfGet(submitPath)
	if err != nil {
		return err
	}

	if strings.Contains(html, "handle-or-email") || strings.Contains(html, "Login into Codeforces") {
		InvalidateCFSession()
		if err := EnsureCFSession(); err != nil {
			return err
		}
		_, html, err = cfGet(submitPath)
		if err != nil {
			return err
		}
	}

	csrf, err := extractCFCSRF(html)
	if err != nil {
		return err
	}

	body := url.Values{
		"csrf_token":            {csrf},
		"action":                {"submitSolutionFormSubmitted"},
		"contestId":             {fmt.Sprintf("%d", p.ContestID)},
		"submittedProblemIndex": {p.ProblemIndex},
		"programTypeId":         {fmt.Sprintf("%d", langID)},
		"source":                {p.SourceCode},
		"tabSize":               {"4"},
		"_tta":                  {fmt.Sprintf("%d", calcTta(csrf))},
	}

	resp, err := cfPost(submitPath, body, submitPath)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusFound && resp.Header.Get("Location") == "" {
		return fmt.Errorf("[CF] submission failed — unexpected response status %d", resp.StatusCode)
	}
	return nil
}

// CFVerdictResult holds a polled verdict from Codeforces.
type CFVerdictResult struct {
	CfID                int
	Verdict             *string
	PassedTestCount     int
	TimeConsumedMillis  int
	MemoryConsumedBytes int
}

// PollCFVerdict polls the Codeforces API for the latest verdict for a submission.
func PollCFVerdict(handle string, contestID int, problemIndex string, minCreationTime int64) (*CFVerdictResult, error) {
	apiURL := fmt.Sprintf("https://codeforces.com/api/user.status?handle=%s&from=1&count=20", handle)
	resp, err := http.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Status string `json:"status"`
		Result []struct {
			ID                  int    `json:"id"`
			ContestID           int    `json:"contestId"`
			Problem             struct{ Index string `json:"index"` } `json:"problem"`
			Verdict             *string `json:"verdict"`
			PassedTestCount     int    `json:"passedTestCount"`
			TimeConsumedMillis  int    `json:"timeConsumedMillis"`
			MemoryConsumedBytes int    `json:"memoryConsumedBytes"`
			CreationTimeSeconds int64  `json:"creationTimeSeconds"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Status != "OK" {
		return nil, nil
	}

	upper := strings.ToUpper(problemIndex)
	for _, s := range data.Result {
		if s.ContestID == contestID &&
			strings.ToUpper(s.Problem.Index) == upper &&
			s.CreationTimeSeconds >= minCreationTime-10 {
			return &CFVerdictResult{
				CfID:                s.ID,
				Verdict:             s.Verdict,
				PassedTestCount:     s.PassedTestCount,
				TimeConsumedMillis:  s.TimeConsumedMillis,
				MemoryConsumedBytes: s.MemoryConsumedBytes,
			}, nil
		}
	}
	return nil, nil
}
