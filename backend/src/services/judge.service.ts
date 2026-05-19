import Redis from 'ioredis';
import { prisma } from '../db/prisma';
import { pistonRun, type Language } from '../lib/piston';
import { runCFJudge } from './cf-judge.service';
import { env } from '../config/env';

// Strip trailing whitespace from each line, then trim the whole output.
// Handles CRLF, trailing spaces, and blank trailing lines consistently.
function normalize(s: string): string {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

// Single persistent publisher reused across all judge calls.
let _publisher: Redis | null = null;
function getPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(env.REDIS_URL);
    _publisher.on('error', (err) => console.error('[publisher] redis error', err));
  }
  return _publisher;
}

async function publishUpdate(submissionId: number): Promise<void> {
  await getPublisher().publish('submission:updated', JSON.stringify({ submissionId }));
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export async function runJudge(submissionId: number): Promise<void> {
  const sub = await prisma.submission.findUnique({
    where:   { id: submissionId },
    include: { problem: { select: { source: true, cfContestId: true, cfIndex: true } } },
  });

  if (sub?.problem?.source === 'codeforces' && sub.problem.cfContestId && sub.problem.cfIndex) {
    await runCFJudge(submissionId, sub.problem.cfContestId, sub.problem.cfIndex);
  } else {
    await runPistonJudge(submissionId);
  }
}

async function runPistonJudge(submissionId: number): Promise<void> {
  await prisma.submission.update({ where: { id: submissionId }, data: { status: 'RUNNING' } });
  await publishUpdate(submissionId);

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { problem: { include: { testcases: { orderBy: { id: 'asc' } } } } },
  });
  if (!submission) return;

  const testcases   = submission.problem?.testcases ?? [];
  const timeLimitMs = submission.problem?.timeLimitMs ?? 2000;
  const details: { index: number; status: string }[] = testcases.map((_, i) => ({
    index: i + 1,
    status: 'QUEUED',
  }));

  await prisma.submissionResult.upsert({
    where:  { submissionId },
    update: { verdict: 'RUNNING', runtimeMs: null, detailsJson: details },
    create: { submissionId, verdict: 'RUNNING', runtimeMs: null, detailsJson: details },
  });
  await publishUpdate(submissionId);

  let verdict    = 'ACCEPTED';
  const startedAt = Date.now();

  for (let i = 0; i < testcases.length; i++) {
    const tc = testcases[i];
    details[i].status = 'RUNNING';

    await prisma.submissionResult.update({
      where: { submissionId },
      data:  { verdict: 'RUNNING', runtimeMs: Date.now() - startedAt, detailsJson: details },
    });
    await publishUpdate(submissionId);

    let tcStatus: string;
    try {
      const result = await pistonRun(
        submission.language as Language,
        submission.sourceCode,
        tc.input,
        timeLimitMs,
      );

      if (result.compilationError) {
        tcStatus = 'COMPILATION_ERROR';
        verdict  = 'COMPILATION_ERROR';
      } else if (result.timedOut) {
        tcStatus = 'TIME_LIMIT_EXCEEDED';
        verdict  = 'TIME_LIMIT_EXCEEDED';
      } else if (result.exitCode !== 0) {
        tcStatus = 'RUNTIME_ERROR';
        verdict  = 'RUNTIME_ERROR';
      } else if (normalize(result.stdout) === normalize(tc.expectedOutput)) {
        tcStatus = 'PASSED';
      } else {
        tcStatus = 'FAILED';
        verdict  = 'WRONG_ANSWER';
      }
    } catch {
      tcStatus = 'RUNTIME_ERROR';
      verdict  = 'RUNTIME_ERROR';
    }

    details[i].status = tcStatus;
    await prisma.submissionResult.update({
      where: { submissionId },
      data:  { verdict: 'RUNNING', runtimeMs: Date.now() - startedAt, detailsJson: details },
    });
    await publishUpdate(submissionId);

    if (verdict !== 'ACCEPTED') break;
  }

  const runtimeMs = Date.now() - startedAt;
  await prisma.submissionResult.upsert({
    where:  { submissionId },
    update: { verdict, runtimeMs, detailsJson: details },
    create: { submissionId, verdict, runtimeMs, detailsJson: details },
  });
  await prisma.submission.update({ where: { id: submissionId }, data: { status: verdict } });
  await publishUpdate(submissionId);
}
