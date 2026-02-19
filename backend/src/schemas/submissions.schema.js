const createSubmissionBodySchema = {
  type: "object",
  required: ["problemId", "language", "sourceCode"],
  additionalProperties: false,
  properties: {
    problemId: { type: "integer", minimum: 1 },
    language: {
      type: "string",
      enum: ["cpp", "c", "java", "python", "javascript"],
    },
    sourceCode: { type: "string", minLength: 1 },
    provider: {
      type: "string",
      enum: ["local", "codeforces"],
      default: "local",
    },
  },
};

const createCodeforcesSubmissionBodySchema = {
  type: "object",
  required: ["language", "sourceCode", "remoteProblemKey"],
  additionalProperties: false,
  properties: {
    language: {
      type: "string",
      enum: ["cpp", "c", "java", "python", "javascript"],
    },
    sourceCode: { type: "string", minLength: 1 },
    remoteProblemKey: { type: "string", minLength: 1 },
  },
};

const submissionSummarySchema = {
  type: "object",
  required: [
    "id",
    "userId",
    "problemId",
    "language",
    "status",
    "provider",
    "externalSubmissionId",
    "externalVerdict",
    "createdAt",
  ],
  properties: {
    id: { type: "integer" },
    userId: { type: "integer" },
    problemId: { type: "integer" },
    language: { type: "string" },
    status: { type: "string" },
    provider: { type: "string" },
    externalSubmissionId: { anyOf: [{ type: "string" }, { type: "null" }] },
    externalVerdict: { anyOf: [{ type: "string" }, { type: "null" }] },
    createdAt: { type: "string", format: "date-time" },
  },
};

const submissionDetailSchema = {
  ...submissionSummarySchema,
  required: [...submissionSummarySchema.required, "sourceCode"],
  properties: {
    ...submissionSummarySchema.properties,
    sourceCode: { type: "string" },
  },
};

const submissionsListResponseSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: { type: "array", items: submissionSummarySchema },
  },
};

const submissionResultSchema = {
  type: "object",
  required: ["id", "submissionId", "verdict", "runtimeMs", "detailsJson", "createdAt"],
  properties: {
    id: { type: "integer" },
    submissionId: { type: "integer" },
    verdict: { type: "string" },
    runtimeMs: { anyOf: [{ type: "integer" }, { type: "null" }] },
    detailsJson: {
      anyOf: [{ type: "array" }, { type: "object" }, { type: "null" }],
    },
    createdAt: { type: "string", format: "date-time" },
  },
};

module.exports = {
  createSubmissionBodySchema,
  createCodeforcesSubmissionBodySchema,
  submissionSummarySchema,
  submissionDetailSchema,
  submissionsListResponseSchema,
  submissionResultSchema,
};
