import { env } from '../config/env';

const CF = 'https://codeforces.com';

// Language IDs on Codeforces (2024/2025 compilers)
const LANG_IDS: Record<string, number> = {
  python:     71,  // Python 3.11
  cpp:        73,  // GNU G++20 13.2 (64 bit)
  c:          43,  // GNU C17 7.3 (64 bit)
  java:       87,  // Java 21 64bit
  javascript: 55,  // JavaScript (V8 Node.js 12)
};

// In-memory cookie jar shared across all requests in this process
const jar: Record<string, string> = {};
let sessionReady = false;

// ── Cookie helpers ───────────────────────────────────────────────────────────

function parseCookies(res: Response): void {
  // Node.js 18+ undici Headers supports getSetCookie()
  const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name  = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) jar[name] = value;
  }
}

function cookieHeader(): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function loadCookieString(raw: string): void {
  raw.split(';').forEach((part) => {
    const eq = part.indexOf('=');
    if (eq === -1) return;
    jar[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  });
}

// ── CSRF helpers ─────────────────────────────────────────────────────────────

function extractCsrf(html: string): string {
  const m = html.match(/name="X-Csrf-Token"\s+content="([^"]+)"/);
  if (!m) throw new Error('[CF] CSRF token not found in page');
  return m[1];
}

function calcTta(csrf: string): number {
  let tta = 0;
  for (let i = 0; i < csrf.length; i++) tta += (i + 1) * csrf.charCodeAt(i);
  return tta;
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

async function cfGet(path: string): Promise<{ res: Response; html: string }> {
  const res = await fetch(`${CF}${path}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124',
      'Cookie':     cookieHeader(),
    },
  });
  parseCookies(res);
  const html = await res.text();
  return { res, html };
}

// Exported authenticated GET for fetching CF pages (problem statements, etc.)
export async function cfAuthGet(path: string): Promise<string> {
  await ensureSession();
  const { html } = await cfGet(path);
  return html;
}

async function cfPost(path: string, body: URLSearchParams, referer: string): Promise<Response> {
  const res = await fetch(`${CF}${path}`, {
    method:   'POST',
    redirect: 'manual',
    headers: {
      'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer':      `${CF}${referer}`,
      'Cookie':       cookieHeader(),
    },
    body: body.toString(),
  });
  parseCookies(res);
  return res;
}

// ── Login ────────────────────────────────────────────────────────────────────

async function login(): Promise<void> {
  if (!env.CF_EMAIL || !env.CF_PASSWORD) {
    throw new Error('[CF] Set CF_EMAIL + CF_PASSWORD (or CF_COOKIE) in .env to judge CF problems');
  }

  const { html } = await cfGet('/enter');
  const csrf = extractCsrf(html);

  const body = new URLSearchParams({
    csrf_token:    csrf,
    action:        'enter',
    handleOrEmail: env.CF_EMAIL,
    password:      env.CF_PASSWORD,
    _tta:          String(calcTta(csrf)),
    remember:      'on',
  });

  const res = await cfPost('/enter', body, '/enter');

  // CF redirects to "/" on success; stays on /enter on failure
  const location = res.headers.get('location') ?? '';
  if (!location || location.includes('/enter')) {
    throw new Error('[CF] Login failed — wrong email/password');
  }

  sessionReady = true;
  console.log('[CF] Logged in successfully');
}

export async function ensureSession(): Promise<void> {
  if (sessionReady) return;

  if (env.CF_COOKIE) {
    loadCookieString(env.CF_COOKIE);
    sessionReady = true;
    console.log('[CF] Session loaded from CF_COOKIE');
    return;
  }

  await login();
}

export function invalidateSession(): void {
  sessionReady = false;
}

// ── Submit ───────────────────────────────────────────────────────────────────

export async function submitToCodeforces(params: {
  contestId:    number;
  problemIndex: string;
  language:     string;
  sourceCode:   string;
}): Promise<void> {
  const langId = LANG_IDS[params.language];
  if (!langId) throw new Error(`[CF] Unsupported language: ${params.language}`);

  const submitPath = `/contest/${params.contestId}/submit`;
  const { html } = await cfGet(submitPath);

  // If redirected to login, session is stale
  if (html.includes('handle-or-email') || html.includes('Login into Codeforces')) {
    invalidateSession();
    await ensureSession();
    const fresh = await cfGet(submitPath);
    return doSubmit(submitPath, params, langId, extractCsrf(fresh.html));
  }

  return doSubmit(submitPath, params, langId, extractCsrf(html));
}

async function doSubmit(
  submitPath: string,
  params: { contestId: number; problemIndex: string; language: string; sourceCode: string },
  langId: number,
  csrf: string,
): Promise<void> {
  const body = new URLSearchParams({
    csrf_token:            csrf,
    action:                'submitSolutionFormSubmitted',
    contestId:             String(params.contestId),
    submittedProblemIndex: params.problemIndex,
    programTypeId:         String(langId),
    source:                params.sourceCode,
    tabSize:               '4',
    _tta:                  String(calcTta(csrf)),
  });

  const res = await cfPost(submitPath, body, submitPath);
  const location = res.headers.get('location') ?? '';

  // CF redirects to /my for successful submission
  if (res.status !== 302 && !location) {
    throw new Error('[CF] Submission failed — unexpected response');
  }
}

// ── Poll verdict ─────────────────────────────────────────────────────────────

export interface CFVerdictResult {
  cfId:               number;
  verdict:            string | null;  // null = still testing
  passedTestCount:    number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
}

export async function pollLatestVerdict(
  handle:          string,
  contestId:       number,
  problemIndex:    string,
  minCreationTime: number,
): Promise<CFVerdictResult | null> {
  const url = `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=20`;
  const res  = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    result: Array<{
      id:                  number;
      contestId:           number;
      problem:             { index: string };
      verdict?:            string;
      passedTestCount:     number;
      timeConsumedMillis:  number;
      memoryConsumedBytes: number;
      creationTimeSeconds: number;
    }>;
  };

  if (data.status !== 'OK') return null;

  const match = data.result.find(
    (s) =>
      s.contestId === contestId &&
      s.problem.index.toUpperCase() === problemIndex.toUpperCase() &&
      s.creationTimeSeconds >= minCreationTime - 10,
  );

  if (!match) return null;

  return {
    cfId:                match.id,
    verdict:             match.verdict ?? null,
    passedTestCount:     match.passedTestCount,
    timeConsumedMillis:  match.timeConsumedMillis,
    memoryConsumedBytes: match.memoryConsumedBytes,
  };
}
