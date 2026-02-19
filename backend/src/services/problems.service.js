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

function mapCodeforcesProblem(problem) {
  const contestId = problem.contestId ?? 0;
  const index = problem.index ?? "";
  const key = `CF-${contestId}-${index}`;
  const tags = Array.isArray(problem.tags) ? problem.tags : [];
  const rating = problem.rating ?? null;
  const points = problem.points ?? null;
  const url = contestId && index
    ? `https://codeforces.com/problemset/problem/${contestId}/${index}`
    : "https://codeforces.com/problemset";

  const statementParts = [
    `Source: Codeforces`,
    `Problem: ${problem.name}`,
    `URL: ${url}`,
    rating ? `Rating: ${rating}` : null,
    points ? `Points: ${points}` : null,
    tags.length > 0 ? `Tags: ${tags.join(", ")}` : "Tags: -",
    "",
    "This is metadata fetched from Codeforces API.",
    "Statement scraping is not included in this endpoint.",
  ].filter(Boolean);

  return {
    id: key,
    source: "codeforces",
    contestId,
    index,
    title: `${contestId}${index}. ${problem.name}`,
    slug: key.toLowerCase(),
    name: problem.name,
    rating,
    points,
    tags,
    url,
    statement: statementParts.join("\n"),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    createdBy: null,
    createdAt: new Date(0).toISOString(),
  };
}

async function fetchCodeforcesProblems({ limit = 100, search = "" } = {}) {
  const response = await fetch("https://codeforces.com/api/problemset.problems");
  if (!response.ok) {
    throw new Error("CODEFORCES_HTTP_ERROR");
  }

  const payload = await response.json();
  if (payload.status !== "OK") {
    throw new Error("CODEFORCES_API_ERROR");
  }

  const normalized = payload.result.problems
    .map(mapCodeforcesProblem)
    .filter((problem) =>
      search
        ? `${problem.title} ${problem.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase())
        : true
    )
    .slice(0, Math.min(Math.max(Number(limit) || 100, 1), 500));

  return normalized;
}

async function fetchCodeforcesProblemByKey(problemKey) {
  const all = await fetchCodeforcesProblems({ limit: 500 });
  return all.find((problem) => problem.id === problemKey) || null;
}

module.exports = {
  createProblem,
  listProblems,
  getProblemById,
  createTestcase,
  listProblemTestcases,
  fetchCodeforcesProblems,
  fetchCodeforcesProblemByKey,
};
