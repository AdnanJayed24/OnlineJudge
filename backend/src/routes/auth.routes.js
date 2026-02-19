const authController = require("../controllers/auth.controller");
const { authGuard } = require("../middleware/auth");
const { commonErrorResponses } = require("../schemas/common.schema");
const {
  registerBodySchema,
  loginBodySchema,
  authSuccessResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
} = require("../schemas/auth.schema");

async function authRoutes(fastify) {
  fastify.post(
    "/register",
    {
      schema: {
        body: registerBodySchema,
        response: { ...commonErrorResponses, 200: authSuccessResponseSchema },
      },
    },
    authController.register
  );
  fastify.post(
    "/login",
    {
      schema: {
        body: loginBodySchema,
        response: { ...commonErrorResponses, 200: authSuccessResponseSchema },
      },
    },
    authController.login
  );
  fastify.post(
    "/refresh",
    { schema: { response: { ...commonErrorResponses, 200: authSuccessResponseSchema } } },
    authController.refresh
  );
  fastify.post(
    "/logout",
    { schema: { response: { ...commonErrorResponses, 200: logoutResponseSchema } } },
    authController.logout
  );
  fastify.get(
    "/me",
    {
      preHandler: authGuard,
      schema: { response: { ...commonErrorResponses, 200: meResponseSchema } },
    },
    authController.me
  );
}

module.exports = authRoutes;
