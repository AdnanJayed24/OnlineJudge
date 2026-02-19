const idParamSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "integer", minimum: 1 },
  },
};

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string" },
  },
};

const validationErrorSchema = {
  type: "object",
  required: ["error", "details"],
  properties: {
    error: { type: "string" },
    details: {
      type: "array",
      items: {
        type: "object",
        required: ["field", "message"],
        properties: {
          field: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
};

const commonErrorResponses = {
  400: {
    oneOf: [errorSchema, validationErrorSchema],
  },
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  409: errorSchema,
  500: errorSchema,
};

module.exports = {
  idParamSchema,
  errorSchema,
  validationErrorSchema,
  commonErrorResponses,
};
