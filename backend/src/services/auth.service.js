const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../lib/jwt");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueTokenPair(user) {
  const sessionId = crypto.randomUUID();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken({ userId: user.id, sessionId });
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      sessionId,
      tokenHash: refreshTokenHash,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}

async function registerUser({ email, username, password }) {
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, role: true },
    });
    const tokens = await issueTokenPair(user);
    return { user, ...tokens };
  } catch (error) {
    if (error.code === "P2002") {
      throw new Error("DUPLICATE_USER");
    }
    throw error;
  }
}

async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      passwordHash: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const safeUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };
  const tokens = await issueTokenPair(safeUser);
  return { user: safeUser, ...tokens };
}

async function refreshTokens({ refreshToken }) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  if (!payload.sessionId || !payload.userId) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const refreshTokenHash = hashToken(refreshToken);
  const session = await prisma.refreshToken.findFirst({
    where: {
      sessionId: payload.sessionId,
      userId: payload.userId,
      tokenHash: refreshTokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: { id: true, email: true, username: true, role: true },
      },
    },
  });

  if (!session) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  await prisma.refreshToken.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokenPair(session.user);
  return { user: session.user, ...tokens };
}

async function logoutUser({ refreshToken }) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return;
  }

  if (!payload.sessionId || !payload.userId) {
    return;
  }

  const refreshTokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: {
      sessionId: payload.sessionId,
      userId: payload.userId,
      tokenHash: refreshTokenHash,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

module.exports = { registerUser, loginUser, refreshTokens, logoutUser };
