const {
  createProblem,
  listProblems,
  getProblemById,
  createTestcase,
  listProblemTestcases,
} = require("../services/problems.service");

async function create(req, reply) {
  const { title, slug, statement, timeLimitMs, memoryLimitMb } = req.body || {};
  if (!title || !slug || !statement) {
    return reply.code(400).send({ error: "title, slug, statement required" });
  }

  try {
    return await createProblem({
      title,
      slug,
      statement,
      timeLimitMs,
      memoryLimitMb,
      createdBy: req.user.userId,
    });
  } catch (error) {
    if (error.message === "DUPLICATE_SLUG") {
      return reply.code(409).send({ error: "slug already exists" });
    }
    req.log.error(error);
    return reply.code(500).send({ error: "create problem failed" });
  }
}

async function list() {
  const items = await listProblems();
  return { items };
}

async function getById(req, reply) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return reply.code(400).send({ error: "invalid id" });
  }

  const problem = await getProblemById(id);
  if (!problem) {
    return reply.code(404).send({ error: "problem not found" });
  }

  return problem;
}

async function createProblemTestcase(req, reply) {
  const problemId = Number(req.params.id);
  if (!Number.isInteger(problemId)) {
    return reply.code(400).send({ error: "invalid id" });
  }

  const { input, expectedOutput, isHidden } = req.body || {};
  if (typeof input !== "string" || typeof expectedOutput !== "string") {
    return reply
      .code(400)
      .send({ error: "input and expectedOutput must be strings" });
  }

  const problem = await getProblemById(problemId);
  if (!problem) {
    return reply.code(404).send({ error: "problem not found" });
  }

  const testcase = await createTestcase({
    problemId,
    input,
    expectedOutput,
    isHidden: isHidden !== false,
  });
  return testcase;
}

async function listTestcases(req, reply) {
  const problemId = Number(req.params.id);
  if (!Number.isInteger(problemId)) {
    return reply.code(400).send({ error: "invalid id" });
  }

  const problem = await getProblemById(problemId);
  if (!problem) {
    return reply.code(404).send({ error: "problem not found" });
  }

  const includeHidden = req.user.role === "admin";
  const items = await listProblemTestcases(problemId, includeHidden);
  return { items };
}

module.exports = { create, list, getById, createProblemTestcase, listTestcases };
