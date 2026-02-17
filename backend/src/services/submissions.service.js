const { prisma } = require("../db/prisma");

async function createSubmission({ userId, problemId, language, sourceCode }) {
  return prisma.submission.create({
    data: {
      userId,
      problemId,
      language,
      sourceCode,
      status: "QUEUED",
    },
    select: {
      id: true,
      userId: true,
      problemId: true,
      language: true,
      status: true,
      createdAt: true,
    },
  });
}

async function listUserSubmissions(userId) {
  return prisma.submission.findMany({
    where: { userId },
    orderBy: { id: "desc" },
    select: {
      id: true,
      userId: true,
      problemId: true,
      language: true,
      status: true,
      createdAt: true,
    },
  });
}

async function getSubmissionById(id) {
  return prisma.submission.findUnique({
    where: { id },
  });
}

async function getProblemById(id) {
  return prisma.problem.findUnique({
    where: { id },
    select: { id: true },
  });
}

module.exports = {
  createSubmission,
  listUserSubmissions,
  getSubmissionById,
  getProblemById,
};
