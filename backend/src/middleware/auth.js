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

async function adminGuard(req, reply) {
  const result = await authGuard(req, reply);
  if (result) return result;

  if (req.user.role !== "admin") {
    return reply.code(403).send({ error: "admin only" });
  }
}

module.exports = { authGuard, adminGuard };
