import Redis from 'ioredis';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import {
  ensureSession,
  submitToCodeforces,
  pollLatestVerdict,
  type CFVerdictResult,
} from '../lib/cf-session';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS        = 30;   // 30 × 3 s = 90 s max wait

const CF_VERDICT_MAP: Record<string, string> = {
  OK:                         'ACCEPTED',
  WRONG_ANSWER:               'WRONG_ANSWER',
  TIME_LIMIT_EXCEEDED:        'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED:      'MEMORY_LIMIT_EXCEEDED',
  RUNTIME_ERROR:              'RUNTIME_ERROR',
  COMPILATION_ERROR:          'COMPILATION_ERROR',
  IDLENESS_LIMIT_EXCEEDED:    'TIME_LIMIT_EXCEEDED',
  CHALLENGED:                 'WRONG_ANSWER',
  PRESENTATION_ERROR:         'WRONG_ANSWER',
  FAILED:                     'RUNTIME_ERROR',
  REJECTED:                   'RUNTIME_ERROR',
};

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function publishUpdate(submissionId: number): Promise<void> {
  const pub = new Redis(env.REDIS_URL);
  await pub.publish('submission:updated', JSON.stringify({ submissionId }));
  await pub.quit();
}

async function setRunning(submissionId: number): Promise<void> {
  await prisma.submission.update({ where: { id: submissionId }, data: { status: 'RUNNING' } });
  await publishUpdate(submissionId);
}

async function finalise(submissionId: number, result: CFVerdictResult): Promise<void> {
  const verdict   = CF_VERDICT_MAP[result.verdict ?? ''] ?? 'RUNTIME_ERROR';
  const runtimeMs = result.timeConsumedMillis;
  const details   = [{
    passedTests: result.passedTestCount,
    memoryMB:    Math.round(result.memoryConsumedBytes / (1024 * 1024)),
    cfId:        result.cfId,
  }];

  await prisma.submissionResult.upsert({
    where:  { submissionId },
    update: { verdict, runtimeMs, detailsJson: details },
    create: { submissionId, verdict, runtimeMs, detailsJson: details },
  });
  await prisma.submission.update({ where: { id: submissionId }, data: { status: verdict } });
  await publishUpdate(submissionId);
}

async function failWith(submissionId: number, reason: string): Promise<void> {
  await prisma.submissionResult.upsert({
    where:  { submissionId },
    update: { verdict: 'RUNTIME_ERROR', runtimeMs: 0, detailsJson: [{ error: reason }] },
    create: { submissionId, verdict: 'RUNTIME_ERROR', runtimeMs: 0, detailsJson: [{ error: reason }] },
  });
  await prisma.submission.update({ where: { id: submissionId }, data: { status: 'RUNTIME_ERROR' } });
  await publishUpdate(submissionId);
}

export async function runCFJudge(
  submissionId: number,
  contestId:    number,
  cfIndex:      string,
): Promise<void> {
  await setRunning(submissionId);

  const submission = await prisma.submission.findUnique({
    where:  { id: submissionId },
    select: { language: true, sourceCode: true },
  });
  if (!submission) return;

  if (!env.CF_HANDLE) {
    await failWith(submissionId, 'CF_HANDLE not configured');
    return;
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  const submitTime = Math.floor(Date.now() / 1000);
  try {
    await ensureSession();
    await submitToCodeforces({
      contestId,
      problemIndex: cfIndex,
      language:     submission.language,
      sourceCode:   submission.sourceCode,
    });
  } catch (err) {
    console.error('[cf-judge] submission failed', err);
    await failWith(submissionId, (err as Error).message);
    return;
  }

  // ── Poll ─────────────────────────────────────────────────────────────────
  await sleep(3000); // give CF a moment to register the submission

  for (let poll = 0; poll < MAX_POLLS; poll++) {
    try {
      const result = await pollLatestVerdict(env.CF_HANDLE, contestId, cfIndex, submitTime);

      if (!result) {
        // Submission not found yet — keep waiting
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      if (result.verdict === null || result.verdict === 'TESTING') {
        // Still running — emit update so frontend shows live status
        await publishUpdate(submissionId);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      // Final verdict arrived
      await finalise(submissionId, result);
      console.log(`[cf-judge] done sub=${submissionId} verdict=${result.verdict}`);
      return;

    } catch (err) {
      console.error('[cf-judge] poll error', err);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  // Timed out
  await failWith(submissionId, 'JUDGE_TIMEOUT');
}
