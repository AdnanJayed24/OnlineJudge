import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccess } from '../lib/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: number;
    userRole?: string;
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies?.access_token;
  if (!token) { reply.status(401).send({ error: 'Unauthorized' }); return; }
  try {
    const p = verifyAccess(token);
    req.userId   = Number(p.sub);
    req.userRole = p.role as string;
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function optionalAuth(req: FastifyRequest): Promise<void> {
  const token = req.cookies?.access_token;
  if (!token) return;
  try {
    const p = verifyAccess(token);
    req.userId   = Number(p.sub);
    req.userRole = p.role as string;
  } catch { /* ignore */ }
}
