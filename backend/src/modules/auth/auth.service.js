const bcrypt = require("bcrypt");
const { prisma } = require("../../db/prisma");
const { signAccessToken } = require("../../lib/jwt");

async function registerUser({ email, username, password }) {
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true },
    });
    const token = signAccessToken(user);
    return { user, token };
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
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const safeUser = { id: user.id, email: user.email, username: user.username };
  const token = signAccessToken(safeUser);
  return { user: safeUser, token };
}

module.exports = { registerUser, loginUser };
