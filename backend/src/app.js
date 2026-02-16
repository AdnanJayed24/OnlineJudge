const Fastify = require("fastify");
const authRoutes = require("./modules/auth/auth.routes");
const problemsRoutes = require("./modules/problems/problems.routes");
const submissionsRoutes = require("./modules/submissions/submissions.routes");
const { prisma } = require("./db/prisma");

function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));

  app.get("/db-check", async (req, reply) => {
    try {
      const rows = await prisma.$queryRaw`SELECT NOW() as now`;
      return { db: "connected", now: rows[0].now };
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({ db: "failed" });
    }
  });

  app.register(authRoutes, { prefix: "/auth" });
  app.register(problemsRoutes, { prefix: "/problems" });
  app.register(submissionsRoutes, { prefix: "/submissions" });

  return app;
}

module.exports = { buildApp };
