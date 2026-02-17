const {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
} = require("../services/auth.service");

const REFRESH_COOKIE_NAME = "refreshToken";

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
  };
}

function setRefreshTokenCookie(reply, refreshToken) {
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...getRefreshCookieOptions(),
    maxAge: 7 * 24 * 60 * 60,
  });
}

function clearRefreshTokenCookie(reply) {
  reply.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
}

async function register(req, reply) {
  const { email, username, password } = req.body || {};
  if (!email || !username || !password) {
    return reply.code(400).send({ error: "email, username, password required" });
  }

  try {
    const result = await registerUser({ email, username, password });
    setRefreshTokenCookie(reply, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  } catch (error) {
    if (error.message === "DUPLICATE_USER") {
      return reply.code(409).send({ error: "email or username already exists" });
    }
    req.log.error(error);
    return reply.code(500).send({ error: "register failed" });
  }
}

async function login(req, reply) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return reply.code(400).send({ error: "email and password required" });
  }

  try {
    const result = await loginUser({ email, password });
    setRefreshTokenCookie(reply, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  } catch (error) {
    if (error.message === "INVALID_CREDENTIALS") {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    req.log.error(error);
    return reply.code(500).send({ error: "login failed" });
  }
}

async function refresh(req, reply) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    return reply.code(401).send({ error: "Missing refresh token cookie" });
  }

  try {
    const result = await refreshTokens({ refreshToken });
    setRefreshTokenCookie(reply, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  } catch (error) {
    if (error.message === "INVALID_REFRESH_TOKEN") {
      clearRefreshTokenCookie(reply);
      return reply.code(401).send({ error: "Invalid refresh token" });
    }
    req.log.error(error);
    return reply.code(500).send({ error: "refresh failed" });
  }
}

async function logout(req, reply) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    clearRefreshTokenCookie(reply);
    return { ok: true };
  }

  await logoutUser({ refreshToken });
  clearRefreshTokenCookie(reply);
  return { ok: true };
}

function me(req) {
  return { user: req.user };
}

module.exports = { register, login, refresh, logout, me };
