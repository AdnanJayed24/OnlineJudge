import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import Redis from 'ioredis';
import { env } from '../config/env';
import { prisma } from '../db/prisma';

let io: SocketIOServer | null = null;

export function initIO(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: { origin: env.FRONTEND_ORIGIN, credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('join:submission', (submissionId: number) => {
      socket.join(`sub:${submissionId}`);
    });
  });

  // Subscribe to Redis pub/sub so the worker can trigger socket emissions
  const sub = new Redis(env.REDIS_URL);
  sub.subscribe('submission:updated');
  sub.on('message', async (_channel, message) => {
    const { submissionId } = JSON.parse(message) as { submissionId: number };
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { result: true },
    });
    if (submission) io?.to(`sub:${submissionId}`).emit('submission:update', submission);
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
