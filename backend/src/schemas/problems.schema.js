const createProblemBodySchema = {
  type: "object",
  required: ["title", "slug", "statement"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    slug: {
      type: "string",
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      minLength: 1,
      maxLength: 120,
    },
    statement: { type: "string", minLength: 1 },
    timeLimitMs: { type: "integer", minimum: 100, maximum: 30000 },
    memoryLimitMb: { type: "integer", minimum: 16, maximum: 2048 },
  },
};

const createTestcaseBodySchema = {
  type: "object",
  required: ["input", "expectedOutput"],
  additionalProperties: false,
  properties: {
    input: { type: "string" },
    expectedOutput: { type: "string" },
    isHidden: { type: "boolean" },
  },
};

const problemSummarySchema = {
  type: "object",
  required: [
    "id",
    "title",
    "slug",
    "timeLimitMs",
    "memoryLimitMb",
    "createdBy",
    "createdAt",
  ],
  properties: {
    id: { type: "integer" },
    title: { type: "string" },
    slug: { type: "string" },
    timeLimitMs: { type: "integer" },
    memoryLimitMb: { type: "integer" },
    createdBy: { anyOf: [{ type: "integer" }, { type: "null" }] },
    createdAt: { type: "string", format: "date-time" },
  },
};

const problemDetailSchema = {
  ...problemSummarySchema,
  required: [...problemSummarySchema.required, "statement"],
  properties: {
    ...problemSummarySchema.properties,
    statement: { type: "string" },
  },
};

const problemsListResponseSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: { type: "array", items: problemSummarySchema },
  },
};

const testcaseSchema = {
  type: "object",
  required: ["id", "input", "isHidden", "createdAt"],
  properties: {
    id: { type: "integer" },
    input: { type: "string" },
    expectedOutput: { type: "string" },
    isHidden: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
  },
};

const testcasesListResponseSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: { type: "array", items: testcaseSchema },
  },
};

const codeforcesProblemSchema = {
  type: "object",
  required: ["id", "source", "title", "slug", "statement", "tags", "url"],
  properties: {
    id: { type: "string" },
    source: { type: "string" },
    contestId: { type: "integer" },
    index: { type: "string" },
    title: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    rating: { anyOf: [{ type: "integer" }, { type: "null" }] },
    points: { anyOf: [{ type: "number" }, { type: "null" }] },
    tags: { type: "array", items: { type: "string" } },
    url: { type: "string" },
    statement: { type: "string" },
    timeLimitMs: { type: "integer" },
    memoryLimitMb: { type: "integer" },
    createdBy: { anyOf: [{ type: "integer" }, { type: "null" }] },
    createdAt: { type: "string" },
  },
};

const codeforcesProblemsListResponseSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: { type: "array", items: codeforcesProblemSchema },
  },
};

module.exports = {
  createProblemBodySchema,
  createTestcaseBodySchema,
  problemSummarySchema,
  problemDetailSchema,
  problemsListResponseSchema,
  testcaseSchema,
  testcasesListResponseSchema,
  codeforcesProblemSchema,
  codeforcesProblemsListResponseSchema,
};
