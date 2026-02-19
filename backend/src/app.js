const Fastify = require("fastify");
const fastifyCookie = require("@fastify/cookie");
const fastifyCors = require("@fastify/cors");
const authRoutes = require("./routes/auth.routes");
const problemsRoutes = require("./routes/problems.routes");
const submissionsRoutes = require("./routes/submissions.routes");
const { prisma } = require("./db/prisma");
const { env } = require("./config/env");

function buildApp() {
  const app = Fastify({ logger: true });
  app.register(fastifyCookie);
  app.register(fastifyCors, {
    origin: env.frontendOrigin,
    credentials: true,
  });

  app.setErrorHandler((error, req, reply) => {
    if (error.validation) {
      return reply.code(400).send({
        error: "Validation failed",
        details: error.validation.map((item) => ({
          field: item.instancePath || item.params?.missingProperty || "",
          message: item.message,
        })),
      });
    }

    if (error.code === "P2002") {
      return reply.code(409).send({ error: "Duplicate resource" });
    }

    req.log.error(error);
    return reply.code(error.statusCode || 500).send({
      error: error.statusCode && error.statusCode < 500 ? error.message : "Internal server error",
    });
  });

  app.setNotFoundHandler((req, reply) => {
    return reply.code(404).send({ error: `Route ${req.method}:${req.url} not found` });
  });

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
