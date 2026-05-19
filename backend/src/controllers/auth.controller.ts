import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { register, login, logout } from '../services/auth.service';
import { verifyRefresh, signAccess } from '../lib/jwt';
import { prisma } from '../db/prisma';

export async function registerHandler(req: FastifyRequest, reply: FastifyReply) {
  const { email, username, password } = req.body as { email: string; username: string; password: string };
  try {
    const user = await register(email, username, password);
    return reply.status(201).send({ user });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return reply.status(409).send({ error: 'Email or username already taken' });
    }
    throw err;
  }
}

export async function loginHandler(req: FastifyRequest, reply: FastifyReply) {
  const { email, password } = req.body as { email: string; password: string };
  try {
    const { accessToken, refreshToken, user } = await login(email, password);
    reply
      .setCookie('access_token',  accessToken,  { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 900 })
      .setCookie('refresh_token', refreshToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 604800 });
    return { user };
  } catch {
    return reply.status(401).send({ error: 'Invalid credentials' });
  }
}

export async function logoutHandler(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.refresh_token;
  if (token) await logout(token);
  reply.clearCookie('access_token').clearCookie('refresh_token');
  return { ok: true };
}

export async function meHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!req.userId) return reply.status(401).send({ error: 'Unauthorized' });
  return { id: req.userId, role: req.userRole };
}

export async function refreshHandler(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.refresh_token;
  if (!token) return reply.status(401).send({ error: 'No refresh token' });

  try {
    const p = verifyRefresh(token);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Refresh token invalid or expired' });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) return reply.status(401).send({ error: 'User not found' });

    const accessToken = signAccess({ sub: user.id, role: user.role });
    reply.setCookie('access_token', accessToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 900 });
    return { ok: true };
  } catch {
    return reply.status(401).send({ error: 'Invalid refresh token' });
  }
}
