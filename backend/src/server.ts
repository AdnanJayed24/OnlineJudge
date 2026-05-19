import 'dotenv/config';
import { buildApp } from './app';
import { initIO } from './sockets/io';
import { prisma } from './db/prisma';
import { env } from './config/env';

async function start(): Promise<void> {
  await prisma.$connect();

  const app = buildApp();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  initIO(app.server as unknown as import('http').Server);
  console.log(`[server] running on http://localhost:${env.PORT}`);
}

start().catch(async (err) => {
  console.error('[server] startup failed', err);
  await prisma.$disconnect();
  process.exit(1);
});
