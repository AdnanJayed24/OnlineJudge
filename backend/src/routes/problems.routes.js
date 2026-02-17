const problemsController = require("../controllers/problems.controller");
const { authGuard, adminGuard } = require("../middleware/auth");

async function problemsRoutes(fastify) {
  fastify.post("/", { preHandler: authGuard }, problemsController.create);
  fastify.get("/", problemsController.list);
  fastify.get("/:id", problemsController.getById);
  fastify.post("/:id/testcases", { preHandler: adminGuard }, problemsController.createProblemTestcase);
  fastify.get("/:id/testcases", { preHandler: authGuard }, problemsController.listTestcases);
}

module.exports = problemsRoutes;
