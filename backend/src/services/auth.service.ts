import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { signAccess, signRefresh, verifyRefresh } from '../lib/jwt';

export async function register(email: string, username: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: { email, username, passwordHash },
    select: { id: true, email: true, username: true, role: true },
  });
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('INVALID_CREDENTIALS');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const sessionId   = crypto.randomUUID();
  const refreshToken = signRefresh({ sub: user.id, sessionId });
  const tokenHash   = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await prisma.refreshToken.create({
    data: {
      sessionId,
      tokenHash,
      userId:    user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = signAccess({ sub: user.id, role: user.role });
  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
  };
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    const p = verifyRefresh(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { sessionId: p.sessionId as string },
      data:  { revokedAt: new Date() },
    });
  } catch { /* ignore invalid token */ }
}
