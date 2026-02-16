const { authGuard } = require("../../middleware/auth");
const { createProblem, listProblems, getProblemById } = require("./problems.service");

async function problemsRoutes(fastify) {
  fastify.post("/", { preHandler: authGuard }, async (req, reply) => {
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
  });

  fastify.get("/", async () => {
    const items = await listProblems();
    return { items };
  });

  fastify.get("/:id", async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    const problem = await getProblemById(id);
    if (!problem) {
      return reply.code(404).send({ error: "problem not found" });
    }

    return problem;
  });
}

module.exports = problemsRoutes;
