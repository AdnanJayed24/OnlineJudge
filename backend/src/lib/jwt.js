const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function signAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role || "user",
    },
    env.jwtAccessSecret,
    { expiresIn: "15m" }
  );
}

function signRefreshToken({ userId, sessionId }) {
  return jwt.sign(
    { userId, sessionId, type: "refresh" },
    env.jwtRefreshSecret,
    { expiresIn: "7d" }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
