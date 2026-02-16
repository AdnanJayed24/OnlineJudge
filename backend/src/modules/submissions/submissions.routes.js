const { authGuard } = require("../../middleware/auth");
const { prisma } = require("../../db/prisma");
const {
  createSubmission,
  listUserSubmissions,
  getSubmissionById,
} = require("./submissions.service");
const { scheduleFakeJudge, emitSubmissionUpdate } = require("./fakeJudge");

async function submissionsRoutes(fastify) {
  fastify.post("/", { preHandler: authGuard }, async (req, reply) => {
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

    const problem = await prisma.problem.findUnique({
      where: { id: numericProblemId },
      select: { id: true },
    });

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
  });

  fastify.get("/", { preHandler: authGuard }, async (req) => {
    const items = await listUserSubmissions(req.user.userId);
    return { items };
  });

  fastify.get("/:id", { preHandler: authGuard }, async (req, reply) => {
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
  });
}

module.exports = submissionsRoutes;
