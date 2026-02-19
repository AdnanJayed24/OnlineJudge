const { env } = require("../config/env");

const CODEFORCES_BASE_URL = "https://codeforces.com";
const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function mapLanguageToCodeforcesId(language) {
  if (language === "cpp") return 54;
  if (language === "c") return 43;
  if (language === "java") return 60;
  if (language === "python") return 31;
  if (language === "javascript") return 34;
  return null;
}

function parseRemoteProblemKey(key) {
  const match = String(key || "").match(/^CF-(\d+)-([A-Za-z0-9]+)$/);
  if (!match) return null;
  return {
    contestId: Number(match[1]),
    index: match[2],
  };
}

function extractCsrfToken(html) {
  const match = String(html || "").match(
    /name=['"]csrf_token['"]\s+value=['"]([^'"]+)['"]/
  );
  return match ? match[1] : null;
}

function formEncode(fields) {
  const params = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    params.set(key, String(value ?? ""));
  });
  return params.toString();
}

function toCookieList(response) {
  if (!response?.headers) return [];
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function parseSetCookieHeader(headerValue) {
  const chunk = String(headerValue || "").split(";")[0];
  const eqIndex = chunk.indexOf("=");
  if (eqIndex < 1) return null;
  return {
    name: chunk.slice(0, eqIndex).trim(),
    value: chunk.slice(eqIndex + 1).trim(),
  };
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  addFromResponse(response) {
    const list = toCookieList(response);
    list.forEach((item) => {
      const parsed = parseSetCookieHeader(item);
      if (!parsed) return;
      this.cookies.set(parsed.name, parsed.value);
    });
  }

  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

async function requestCodeforces(pathname, options = {}) {
  const {
    method = "GET",
    headers = {},
    body,
    jar,
    referer,
    expectedStatus = null,
  } = options;
  const url = pathname.startsWith("http")
    ? pathname
    : `${CODEFORCES_BASE_URL}${pathname}`;

  const requestHeaders = {
    ...DEFAULT_HEADERS,
    ...headers,
  };

  if (jar) {
    const cookieHeader = jar.toHeader();
    if (cookieHeader) requestHeaders.cookie = cookieHeader;
  }
  if (referer) requestHeaders.referer = referer;

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body,
    redirect: "manual",
  });

  if (jar) jar.addFromResponse(response);

  if (expectedStatus && !expectedStatus.includes(response.status)) {
    const text = await response.text();
    throw new Error(`CODEFORCES_HTTP_${response.status}:${text.slice(0, 120)}`);
  }
  return response;
}

async function loginCodeforces(jar) {
  const enterPage = await requestCodeforces("/enter", {
    jar,
    expectedStatus: [200],
  });
  const enterHtml = await enterPage.text();
  const csrfToken = extractCsrfToken(enterHtml);
  if (!csrfToken) throw new Error("CODEFORCES_LOGIN_CSRF_MISSING");

  const payload = formEncode({
    csrf_token: csrfToken,
    action: "enter",
    handleOrEmail: env.codeforcesHandleOrEmail,
    password: env.codeforcesPassword,
    _tta: "176",
    remember: "on",
  });

  const loginResponse = await requestCodeforces("/enter", {
    method: "POST",
    jar,
    referer: `${CODEFORCES_BASE_URL}/enter`,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: CODEFORCES_BASE_URL,
    },
    body: payload,
    expectedStatus: [302, 200],
  });

  if (loginResponse.status === 200) {
    const loginHtml = await loginResponse.text();
    if (loginHtml.toLowerCase().includes("captcha")) {
      throw new Error("CODEFORCES_LOGIN_CAPTCHA_REQUIRED");
    }
    if (loginHtml.toLowerCase().includes("invalid handle/email or password")) {
      throw new Error("CODEFORCES_LOGIN_INVALID_CREDENTIALS");
    }
  }
}

async function submitSolutionToCodeforces({
  jar,
  contestId,
  index,
  languageId,
  sourceCode,
}) {
  const problemUrl = `/problemset/problem/${contestId}/${index}`;
  const problemPage = await requestCodeforces(problemUrl, {
    jar,
    expectedStatus: [200],
  });
  const problemHtml = await problemPage.text();
  const csrfToken = extractCsrfToken(problemHtml);
  if (!csrfToken) throw new Error("CODEFORCES_SUBMIT_CSRF_MISSING");

  const statusBefore = await getLatestSubmissionIdForHandle(env.codeforcesHandle);

  const submitPayload = formEncode({
    csrf_token: csrfToken,
    action: "submitSolutionFormSubmitted",
    submittedProblemIndex: index,
    contestId,
    programTypeId: languageId,
    source: sourceCode,
    tabSize: 4,
    sourceFile: "",
    _tta: "594",
  });

  await requestCodeforces("/problemset/submit", {
    method: "POST",
    jar,
    referer: `${CODEFORCES_BASE_URL}${problemUrl}`,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: CODEFORCES_BASE_URL,
    },
    body: submitPayload,
    expectedStatus: [302, 200],
  });

  const externalSubmissionId = await waitForNewSubmissionId({
    handle: env.codeforcesHandle,
    previousLatestId: statusBefore,
    contestId,
    index,
    maxAttempts: 8,
    intervalMs: 1500,
  });

  if (!externalSubmissionId) {
    throw new Error("CODEFORCES_SUBMISSION_ID_NOT_FOUND");
  }

  return externalSubmissionId;
}

async function getLatestSubmissionIdForHandle(handle) {
  const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(
    handle
  )}&from=1&count=1`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const json = await response.json();
  if (json.status !== "OK" || !Array.isArray(json.result) || json.result.length === 0) {
    return null;
  }
  return Number(json.result[0].id) || null;
}

async function waitForNewSubmissionId({
  handle,
  previousLatestId,
  contestId,
  index,
  maxAttempts,
  intervalMs,
}) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(
      handle
    )}&from=1&count=20`;
    const response = await fetch(url);
    if (response.ok) {
      const json = await response.json();
      if (json.status === "OK" && Array.isArray(json.result)) {
        const hit = json.result.find((entry) => {
          const id = Number(entry.id) || 0;
          const matchesId = !previousLatestId || id > previousLatestId;
          return (
            matchesId &&
            Number(entry.problem?.contestId) === Number(contestId) &&
            String(entry.problem?.index) === String(index)
          );
        });
        if (hit?.id) return String(hit.id);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

function mapCodeforcesVerdictToLocal(verdict) {
  if (!verdict) return "RUNNING";
  if (verdict === "OK") return "ACCEPTED";
  if (verdict === "WRONG_ANSWER") return "WRONG_ANSWER";
  if (
    verdict === "RUNTIME_ERROR" ||
    verdict === "COMPILATION_ERROR" ||
    verdict === "TIME_LIMIT_EXCEEDED" ||
    verdict === "MEMORY_LIMIT_EXCEEDED"
  ) {
    return "RUNTIME_ERROR";
  }
  return "RUNNING";
}

async function pollCodeforcesVerdict({ submissionId, externalSubmissionId }) {
  const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(
    env.codeforcesHandle
  )}&from=1&count=50`;
  const response = await fetch(url);
  if (!response.ok) {
    return {
      state: "pending",
      nextPollMs: 5000,
      externalSubmissionId,
      externalVerdict: "API_UNAVAILABLE",
    };
  }

  const json = await response.json();
  if (json.status !== "OK" || !Array.isArray(json.result)) {
    return {
      state: "pending",
      nextPollMs: 5000,
      externalSubmissionId,
      externalVerdict: "API_ERROR",
    };
  }

  const matched = json.result.find(
    (entry) => String(entry.id) === String(externalSubmissionId)
  );
  if (!matched) {
    return {
      state: "pending",
      nextPollMs: 5000,
      externalSubmissionId,
      externalVerdict: "NOT_FOUND_YET",
    };
  }

  const cfVerdict = matched.verdict || "TESTING";
  const localStatus = mapCodeforcesVerdictToLocal(cfVerdict);
  if (localStatus === "RUNNING") {
    return {
      state: "pending",
      nextPollMs: 4000,
      externalSubmissionId,
      externalVerdict: cfVerdict,
    };
  }

  return {
    state: "final",
    status: localStatus,
    externalSubmissionId,
    externalVerdict: cfVerdict,
    runtimeMs: matched.timeConsumedMillis ?? null,
    details: [
      {
        cfSubmissionId: String(matched.id),
        passedTests: matched.passedTestCount ?? null,
        problem: {
          contestId: matched.problem?.contestId ?? null,
          index: matched.problem?.index ?? null,
          name: matched.problem?.name ?? null,
        },
      },
    ],
  };
}

async function submitToCodeforces({ submission, executionMeta = {}, logger }) {
  if (!env.codeforcesHandle || !env.codeforcesPassword || !env.codeforcesHandleOrEmail) {
    return {
      state: "final",
      status: "RUNTIME_ERROR",
      externalVerdict: "CREDENTIALS_MISSING",
      errorReason: "CODEFORCES_CREDENTIALS_MISSING",
    };
  }

  const remoteProblemKey = executionMeta.remoteProblemKey || null;
  if (!remoteProblemKey) {
    return {
      state: "final",
      status: "RUNTIME_ERROR",
      externalVerdict: "REMOTE_PROBLEM_KEY_MISSING",
      errorReason: "CODEFORCES_REMOTE_PROBLEM_KEY_MISSING",
    };
  }

  const parsed = parseRemoteProblemKey(remoteProblemKey);
  if (!parsed) {
    return {
      state: "final",
      status: "RUNTIME_ERROR",
      externalVerdict: "REMOTE_PROBLEM_KEY_INVALID",
      errorReason: "CODEFORCES_REMOTE_PROBLEM_KEY_INVALID",
    };
  }

  const languageId = mapLanguageToCodeforcesId(submission.language);
  if (!languageId) {
    return {
      state: "final",
      status: "RUNTIME_ERROR",
      externalVerdict: "LANGUAGE_NOT_SUPPORTED",
      errorReason: "CODEFORCES_LANGUAGE_NOT_SUPPORTED",
    };
  }

  const externalSubmissionId = executionMeta.externalSubmissionId;
  if (!externalSubmissionId) {
    try {
      const jar = new CookieJar();
      await loginCodeforces(jar);
      const createdExternalId = await submitSolutionToCodeforces({
        jar,
        contestId: parsed.contestId,
        index: parsed.index,
        languageId,
        sourceCode: submission.sourceCode,
      });

      logger.info(
        { submissionId: submission.id, externalSubmissionId: createdExternalId },
        "codeforces submission created"
      );

      return {
        state: "pending",
        nextPollMs: 4000,
        externalSubmissionId: createdExternalId,
        externalVerdict: "SUBMITTED",
      };
    } catch (error) {
      logger.error({ error, submissionId: submission.id }, "codeforces submit failed");
      return {
        state: "final",
        status: "RUNTIME_ERROR",
        externalVerdict: "SUBMIT_FAILED",
        errorReason: error.message || "CODEFORCES_SUBMIT_FAILED",
      };
    }
  }

  return pollCodeforcesVerdict({
    submissionId: submission.id,
    externalSubmissionId,
  });
}

module.exports = {
  submitToCodeforces,
};
