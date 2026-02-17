const authController = require("../controllers/auth.controller");
const { authGuard } = require("../middleware/auth");

async function authRoutes(fastify) {
  fastify.post("/register", authController.register);
  fastify.post("/login", authController.login);
  fastify.post("/refresh", authController.refresh);
  fastify.post("/logout", authController.logout);
  fastify.get("/me", { preHandler: authGuard }, authController.me);
}

module.exports = authRoutes;
