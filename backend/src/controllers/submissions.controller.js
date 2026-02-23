const {
  createSubmission,
  listUserSubmissions,
  getSubmissionById,
  getSubmissionResultBySubmissionId,
  getProblemById,
  getOrCreateRemoteProblem,
} = require("../services/submissions.service");
const {
  emitSubmissionUpdate,
  markSubmissionRuntimeError,
  scheduleSubmissionJudge,
} = require("../services/judge.service");
const { enqueueSubmissionJob } = require("../queue/submission.queue");
const { checkCodeforcesSession } = require("../services/codeforces.service");

async function createWithProvider(req, reply, providerName) {
  const { problemId, language, sourceCode, remoteProblemKey } = req.body;
  const provider = providerName || req.body.provider || "local";
  let numericProblemId;

  if (provider !== "codeforces") {
    return reply.code(400).send({ error: "Only codeforces provider is allowed" });
  }

  if (provider === "codeforces") {
    if (!remoteProblemKey) {
      return reply.code(400).send({ error: "remoteProblemKey is required for codeforces provider" });
    }
    const remoteProblem = await getOrCreateRemoteProblem(remoteProblemKey);
    numericProblemId = remoteProblem.id;
  } else {
    numericProblemId = Number(problemId);
  }

  const problem = await getProblemById(numericProblemId);
  if (!problem) {
    return reply.code(404).send({ error: "problem not found" });
  }

  const submission = await createSubmission({
    userId: req.user.userId,
    problemId: numericProblemId,
    language,
    sourceCode,
    provider,
  });

  await emitSubmissionUpdate(submission.id);
  try {
    await enqueueSubmissionJob(submission.id, provider, {
      executionMeta:
        provider === "codeforces" && req.body.remoteProblemKey
          ? { remoteProblemKey: req.body.remoteProblemKey }
          : {},
    });
  } catch (error) {
    req.log.error({ error, submissionId: submission.id }, "queue enqueue failed, using local fallback");
    if (provider === "local") {
      scheduleSubmissionJudge(submission.id, req.log);
    } else {
      await markSubmissionRuntimeError(submission.id, "QUEUE_UNAVAILABLE");
    }
  }
  return submission;
}

async function create(req, reply) {
  return createWithProvider(req, reply, req.body.provider || "local");
}

async function createCodeforces(req, reply) {
  return createWithProvider(req, reply, "codeforces");
}

async function list(req) {
  const items = await listUserSubmissions(req.user.userId);
  return { items };
}

async function getById(req, reply) {
  const id = Number(req.params.id);

  const submission = await getSubmissionById(id);
  if (!submission) {
    return reply.code(404).send({ error: "submission not found" });
  }

  if (submission.userId !== req.user.userId) {
    return reply.code(403).send({ error: "forbidden" });
  }

  return submission;
}

async function getResult(req, reply) {
  const id = Number(req.params.id);

  const submission = await getSubmissionById(id);
  if (!submission) {
    return reply.code(404).send({ error: "submission not found" });
  }

  if (submission.userId !== req.user.userId && req.user.role !== "admin") {
    return reply.code(403).send({ error: "forbidden" });
  }

  const result = await getSubmissionResultBySubmissionId(id);
  if (!result) {
    return reply.code(404).send({ error: "result not ready" });
  }

  return result;
}

async function codeforcesHealth(req, reply) {
  try {
    return await checkCodeforcesSession();
  } catch (error) {
    req.log.error({ error }, "codeforces session check failed");
    return reply.code(502).send({
      ok: false,
      error: error.message || "CODEFORCES_SESSION_CHECK_FAILED",
    });
  }
}

module.exports = {
  create,
  createCodeforces,
  list,
  getById,
  getResult,
  codeforcesHealth,
};
