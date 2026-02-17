const {
  createSubmission,
  listUserSubmissions,
  getSubmissionById,
  getProblemById,
} = require("../services/submissions.service");
const { scheduleFakeJudge, emitSubmissionUpdate } = require("../services/judge.service");

async function create(req, reply) {
  const { problemId, language, sourceCode } = req.body || {};
  if (!problemId || !language || !sourceCode) {
    return reply
      .code(400)
      .send({ error: "problemId, language, sourceCode required" });
  }

  const numericProblemId = Number(problemId);
  if (!Number.isInteger(numericProblemId)) {
    return reply.code(400).send({ error: "invalid problemId" });
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
  });

  await emitSubmissionUpdate(submission.id);
  scheduleFakeJudge(submission.id, req.log);
  return submission;
}

async function list(req) {
  const items = await listUserSubmissions(req.user.userId);
  return { items };
}

async function getById(req, reply) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return reply.code(400).send({ error: "invalid id" });
  }

  const submission = await getSubmissionById(id);
  if (!submission) {
    return reply.code(404).send({ error: "submission not found" });
  }

  if (submission.userId !== req.user.userId) {
    return reply.code(403).send({ error: "forbidden" });
  }

  return submission;
}

module.exports = { create, list, getById };
