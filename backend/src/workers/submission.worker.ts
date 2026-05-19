import 'dotenv/config';
import { Worker } from 'bullmq';
import { prisma } from '../db/prisma';
import { runJudge } from '../services/judge.service';
import { getBullMQConnection } from '../queue/connection';
import { QUEUE_NAME, JOB_NAME } from '../queue/submission.queue';

async function start(): Promise<void> {
  await prisma.$connect();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== JOB_NAME) return;
      const submissionId = Number(job.data?.submissionId);
      if (!Number.isInteger(submissionId)) throw new Error('INVALID_SUBMISSION_ID');
      await runJudge(submissionId);
    },
    { connection: getBullMQConnection() },
  );

  worker.on('ready',     ()       => console.log('[worker] ready'));
  worker.on('completed', (job)    => console.log(`[worker] done job=${job.id}`));
  worker.on('failed',    (job, e) => console.error(`[worker] failed job=${job?.id}`, e));

  const shutdown = async () => {
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(async (err) => {
  console.error('[worker] startup failed', err);
  await prisma.$disconnect();
  process.exit(1);
});
