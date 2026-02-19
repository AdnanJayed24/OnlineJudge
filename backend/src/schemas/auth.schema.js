const registerBodySchema = {
  type: "object",
  required: ["email", "username", "password"],
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email", minLength: 3, maxLength: 255 },
    username: { type: "string", minLength: 3, maxLength: 32 },
    password: { type: "string", minLength: 6, maxLength: 128 },
  },
};

const loginBodySchema = {
  type: "object",
  required: ["email", "password"],
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email", minLength: 3, maxLength: 255 },
    password: { type: "string", minLength: 6, maxLength: 128 },
  },
};

const authUserSchema = {
  type: "object",
  required: ["id", "email", "username", "role"],
  properties: {
    id: { type: "integer" },
    email: { type: "string" },
    username: { type: "string" },
    role: { type: "string" },
  },
};

const authSuccessResponseSchema = {
  type: "object",
  required: ["user", "accessToken"],
  properties: {
    user: authUserSchema,
    accessToken: { type: "string" },
  },
};

const logoutResponseSchema = {
  type: "object",
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
  },
};

const meResponseSchema = {
  type: "object",
  required: ["user"],
  properties: {
    user: {
      type: "object",
      additionalProperties: true,
    },
  },
};

module.exports = {
  registerBodySchema,
  loginBodySchema,
  authSuccessResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
};
