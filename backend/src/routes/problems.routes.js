const problemsController = require("../controllers/problems.controller");
const { authGuard, adminGuard } = require("../middleware/auth");
const { idParamSchema, commonErrorResponses } = require("../schemas/common.schema");
const {
  createProblemBodySchema,
  createTestcaseBodySchema,
  problemSummarySchema,
  problemDetailSchema,
  problemsListResponseSchema,
  testcaseSchema,
  testcasesListResponseSchema,
  codeforcesProblemSchema,
  codeforcesProblemsListResponseSchema,
} = require("../schemas/problems.schema");

const codeforcesListQuerySchema = {
  type: "object",
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 500 },
    search: { type: "string" },
  },
};

const codeforcesKeyParamSchema = {
  type: "object",
  required: ["key"],
  properties: {
    key: { type: "string" },
  },
};

async function problemsRoutes(fastify) {
  fastify.post(
    "/",
    {
      preHandler: authGuard,
      schema: {
        body: createProblemBodySchema,
        response: { ...commonErrorResponses, 200: problemSummarySchema },
      },
    },
    problemsController.create
  );
  fastify.get(
    "/",
    { schema: { response: { ...commonErrorResponses, 200: problemsListResponseSchema } } },
    problemsController.list
  );
  fastify.get(
    "/codeforces",
    {
      schema: {
        querystring: codeforcesListQuerySchema,
        response: { ...commonErrorResponses, 200: codeforcesProblemsListResponseSchema },
      },
    },
    problemsController.listCodeforces
  );
  fastify.get(
    "/codeforces/:key",
    {
      schema: {
        params: codeforcesKeyParamSchema,
        response: { ...commonErrorResponses, 200: codeforcesProblemSchema },
      },
    },
    problemsController.getCodeforcesByKey
  );
  fastify.get(
    "/:id",
    {
      schema: {
        params: idParamSchema,
        response: { ...commonErrorResponses, 200: problemDetailSchema },
      },
    },
    problemsController.getById
  );
  fastify.post(
    "/:id/testcases",
    {
      preHandler: adminGuard,
      schema: {
        params: idParamSchema,
        body: createTestcaseBodySchema,
        response: { ...commonErrorResponses, 200: testcaseSchema },
      },
    },
    problemsController.createProblemTestcase
  );
  fastify.get(
    "/:id/testcases",
    {
      preHandler: authGuard,
      schema: {
        params: idParamSchema,
        response: { ...commonErrorResponses, 200: testcasesListResponseSchema },
      },
    },
    problemsController.listTestcases
  );
}

module.exports = problemsRoutes;
