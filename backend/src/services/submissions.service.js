const { prisma } = require("../db/prisma");

const submissionBaseSelect = {
  id: true,
  userId: true,
  problemId: true,
  language: true,
  status: true,
  provider: true,
  externalSubmissionId: true,
  externalVerdict: true,
  createdAt: true,
};

async function createSubmission({
  userId,
  problemId,
  language,
  sourceCode,
  provider = "local",
}) {
  return prisma.submission.create({
    data: {
      userId,
      problemId,
      language,
      sourceCode,
      status: "QUEUED",
      provider,
    },
    select: submissionBaseSelect,
  });
}

async function listUserSubmissions(userId) {
  return prisma.submission.findMany({
    where: { userId },
    orderBy: { id: "desc" },
    select: submissionBaseSelect,
  });
}

async function getSubmissionById(id) {
  return prisma.submission.findUnique({
    where: { id },
  });
}

async function getSubmissionResultBySubmissionId(submissionId) {
  return prisma.submissionResult.findUnique({
    where: { submissionId },
  });
}

async function getProblemById(id) {
  return prisma.problem.findUnique({
    where: { id },
    select: { id: true },
  });
}

function buildRemoteProblemSlug(remoteProblemKey) {
  return `cf-${String(remoteProblemKey || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)}`;
}

async function getOrCreateRemoteProblem(remoteProblemKey) {
  const slug = buildRemoteProblemSlug(remoteProblemKey);
  return prisma.problem.upsert({
    where: { slug },
    update: {},
    create: {
      title: `Codeforces ${remoteProblemKey}`,
      slug,
      statement: `Remote Codeforces problem key: ${remoteProblemKey}`,
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      createdBy: null,
    },
    select: { id: true },
  });
}

async function updateSubmissionExecutionMeta(
  submissionId,
  { status, externalSubmissionId, externalVerdict }
) {
  return prisma.submission.update({
    where: { id: submissionId },
    data: {
      ...(status ? { status } : {}),
      ...(externalSubmissionId !== undefined ? { externalSubmissionId } : {}),
      ...(externalVerdict !== undefined ? { externalVerdict } : {}),
    },
    select: submissionBaseSelect,
  });
}

module.exports = {
  createSubmission,
  listUserSubmissions,
  getSubmissionById,
  getSubmissionResultBySubmissionId,
  getProblemById,
  getOrCreateRemoteProblem,
  updateSubmissionExecutionMeta,
};
