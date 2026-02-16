const { verifyAccessToken } = require("../lib/jwt");

async function authGuard(req, reply) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing token" });
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    req.user = verifyAccessToken(token);
  } catch {
    return reply.code(401).send({ error: "Invalid token" });
  }
}

module.exports = { authGuard };
