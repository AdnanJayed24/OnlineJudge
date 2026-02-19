const submissionsController = require("../controllers/submissions.controller");
const { authGuard } = require("../middleware/auth");
const { idParamSchema, commonErrorResponses } = require("../schemas/common.schema");
const {
  createSubmissionBodySchema,
  createCodeforcesSubmissionBodySchema,
  submissionSummarySchema,
  submissionDetailSchema,
  submissionsListResponseSchema,
  submissionResultSchema,
} = require("../schemas/submissions.schema");

async function submissionsRoutes(fastify) {
  fastify.post(
    "/",
    {
      preHandler: authGuard,
      schema: {
        body: createSubmissionBodySchema,
        response: { ...commonErrorResponses, 200: submissionSummarySchema },
      },
    },
    submissionsController.create
  );
  fastify.post(
    "/codeforces",
    {
      preHandler: authGuard,
      schema: {
        body: createCodeforcesSubmissionBodySchema,
        response: { ...commonErrorResponses, 200: submissionSummarySchema },
      },
    },
    submissionsController.createCodeforces
  );
  fastify.get(
    "/",
    {
      preHandler: authGuard,
      schema: { response: { ...commonErrorResponses, 200: submissionsListResponseSchema } },
    },
    submissionsController.list
  );
  fastify.get(
    "/:id",
    {
      preHandler: authGuard,
      schema: {
        params: idParamSchema,
        response: { ...commonErrorResponses, 200: submissionDetailSchema },
      },
    },
    submissionsController.getById
  );
  fastify.get(
    "/:id/result",
    {
      preHandler: authGuard,
      schema: {
        params: idParamSchema,
        response: { ...commonErrorResponses, 200: submissionResultSchema },
      },
    },
    submissionsController.getResult
  );
}

module.exports = submissionsRoutes;
