import { prisma } from '../db/prisma';
import { enqueueSubmission } from '../queue/submission.queue';

export async function createSubmission(
  userId: number,
  problemId: number,
  language: string,
  sourceCode: string,
) {
  const submission = await prisma.submission.create({
    data: { userId, problemId, language, sourceCode, status: 'QUEUED' },
  });
  await enqueueSubmission(submission.id);
  return submission;
}

export async function getSubmission(id: number) {
  return prisma.submission.findUnique({
    where: { id },
    include: { result: true },
  });
}

export async function listSubmissions(userId: number, problemId?: number) {
  return prisma.submission.findMany({
    where: { userId, ...(problemId ? { problemId } : {}) },
    include: {
      result: true,
      problem: { select: { title: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
