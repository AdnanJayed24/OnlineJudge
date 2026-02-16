const { registerUser, loginUser } = require("./auth.service");
const { authGuard } = require("../../middleware/auth");

async function authRoutes(fastify) {
  fastify.post("/register", async (req, reply) => {
    const { email, username, password } = req.body || {};
    if (!email || !username || !password) {
      return reply
        .code(400)
        .send({ error: "email, username, password required" });
    }

    try {
      return await registerUser({ email, username, password });
    } catch (error) {
      if (error.message === "DUPLICATE_USER") {
        return reply
          .code(409)
          .send({ error: "email or username already exists" });
      }
      req.log.error(error);
      return reply.code(500).send({ error: "register failed" });
    }
  });

  fastify.post("/login", async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: "email and password required" });
    }

    try {
      return await loginUser({ email, password });
    } catch (error) {
      if (error.message === "INVALID_CREDENTIALS") {
        return reply.code(401).send({ error: "Invalid credentials" });
      }
      req.log.error(error);
      return reply.code(500).send({ error: "login failed" });
    }
  });

  fastify.get("/me", { preHandler: authGuard }, async (req) => {
    return { user: req.user };
  });
}

module.exports = authRoutes;
