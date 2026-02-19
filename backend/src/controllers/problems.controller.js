const {
  createProblem,
  listProblems,
  getProblemById,
  createTestcase,
  listProblemTestcases,
  fetchCodeforcesProblems,
  fetchCodeforcesProblemByKey,
} = require("../services/problems.service");

async function create(req, reply) {
  const { title, slug, statement, timeLimitMs, memoryLimitMb } = req.body;

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

  const problem = await getProblemById(id);
  if (!problem) {
    return reply.code(404).send({ error: "problem not found" });
  }

  return problem;
}

async function createProblemTestcase(req, reply) {
  const problemId = Number(req.params.id);

  const { input, expectedOutput, isHidden } = req.body;

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

  const problem = await getProblemById(problemId);
  if (!problem) {
    return reply.code(404).send({ error: "problem not found" });
  }

  const includeHidden = req.user.role === "admin";
  const items = await listProblemTestcases(problemId, includeHidden);
  return { items };
}

async function listCodeforces(req, reply) {
  const limit = Number(req.query.limit || 100);
  const search = String(req.query.search || "");

  try {
    const items = await fetchCodeforcesProblems({ limit, search });
    return { items };
  } catch (error) {
    req.log.error(error);
    return reply.code(502).send({ error: "failed to fetch codeforces problems" });
  }
}

async function getCodeforcesByKey(req, reply) {
  try {
    const problem = await fetchCodeforcesProblemByKey(req.params.key);
    if (!problem) {
      return reply.code(404).send({ error: "problem not found" });
    }
    return problem;
  } catch (error) {
    req.log.error(error);
    return reply.code(502).send({ error: "failed to fetch codeforces problem" });
  }
}

module.exports = {
  create,
  list,
  getById,
  createProblemTestcase,
  listTestcases,
  listCodeforces,
  getCodeforcesByKey,
};
