const { prisma } = require("../db/prisma");

async function createProblem({ title, slug, statement, timeLimitMs, memoryLimitMb, createdBy }) {
  try {
    return await prisma.problem.create({
      data: {
        title,
        slug,
        statement,
        timeLimitMs: timeLimitMs || 1000,
        memoryLimitMb: memoryLimitMb || 256,
        createdBy,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new Error("DUPLICATE_SLUG");
    }
    throw error;
  }
}

async function listProblems() {
  return prisma.problem.findMany({
    orderBy: { id: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      timeLimitMs: true,
      memoryLimitMb: true,
      createdBy: true,
      createdAt: true,
    },
  });
}

async function getProblemById(id) {
  return prisma.problem.findUnique({
    where: { id },
  });
}

async function createTestcase({ problemId, input, expectedOutput, isHidden }) {
  return prisma.testcase.create({
    data: {
      problemId,
      input,
      expectedOutput,
      isHidden: Boolean(isHidden),
    },
  });
}

async function listProblemTestcases(problemId, includeHidden) {
  return prisma.testcase.findMany({
    where: {
      problemId,
      ...(includeHidden ? {} : { isHidden: false }),
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      input: true,
      expectedOutput: includeHidden,
      isHidden: true,
      createdAt: true,
    },
  });
}

module.exports = {
  createProblem,
  listProblems,
  getProblemById,
  createTestcase,
  listProblemTestcases,
};
