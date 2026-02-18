const submissionsController = require("../controllers/submissions.controller");
const { authGuard } = require("../middleware/auth");

async function submissionsRoutes(fastify) {
  fastify.post("/", { preHandler: authGuard }, submissionsController.create);
  fastify.get("/", { preHandler: authGuard }, submissionsController.list);
  fastify.get("/:id", { preHandler: authGuard }, submissionsController.getById);
  fastify.get("/:id/result", { preHandler: authGuard }, submissionsController.getResult);
}

module.exports = submissionsRoutes;
