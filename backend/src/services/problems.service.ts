import { prisma } from '../db/prisma';
import { fetchCFStatementHtml } from './codeforces.service';

export const CF_FETCH_FAILED = '<!-- CF_FETCH_FAILED -->';

function isPlaceholder(statement: string): boolean {
  if (statement === CF_FETCH_FAILED) return false;
  return statement.includes('View the full problem statement on Codeforces') || statement.length < 600;
}

export async function listProblems(userId?: number, opts?: { source?: string; q?: string }) {
  const where: {
    source?: string;
    OR?: { title?: { contains: string; mode: 'insensitive' }; tags?: { has: string } }[];
  } = {};

  if (opts?.source && opts.source !== 'all') where.source = opts.source;
  if (opts?.q?.trim()) {
    where.OR = [
      { title: { contains: opts.q.trim(), mode: 'insensitive' } },
      { tags: { has: opts.q.trim().toLowerCase() } },
    ];
  }

  const problems = await prisma.problem.findMany({
    where,
    select: {
      id: true, title: true, slug: true, difficulty: true, tags: true,
      source: true, cfContestId: true, cfIndex: true,
      rating: true, externalUrl: true, lcFrontendId: true,
      timeLimitMs: true, memoryLimitMb: true,
      _count: { select: { submissions: true } },
    },
    orderBy: { id: 'asc' },
  });

  if (!userId) return problems.map((p) => ({ ...p, solved: false }));

  const solved = await prisma.submission.findMany({
    where: { userId, status: 'ACCEPTED' },
    select: { problemId: true },
    distinct: ['problemId'],
  });
  const solvedSet = new Set(solved.map((s) => s.problemId));
  return problems.map((p) => ({ ...p, solved: solvedSet.has(p.id) }));
}

export async function getProblem(slug: string) {
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: {
      id: true, title: true, slug: true,
      statement: true, inputFormat: true, outputFormat: true, note: true,
      difficulty: true, tags: true, source: true,
      cfContestId: true, cfIndex: true,
      rating: true, externalUrl: true, lcFrontendId: true,
      timeLimitMs: true, memoryLimitMb: true,
      testcases: {
        where: { isHidden: false },
        select: { id: true, input: true, expectedOutput: true },
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!problem) return null;

  // Auto-fetch real statement for CF problems that still have a bulk-sync placeholder
  if (
    problem.source === 'codeforces' &&
    problem.cfContestId &&
    problem.cfIndex &&
    isPlaceholder(problem.statement)
  ) {
    const html = await fetchCFStatementHtml(problem.cfContestId, problem.cfIndex);
    const newStatement = html && html.length >= 600 ? html : CF_FETCH_FAILED;
    await prisma.problem.update({ where: { slug }, data: { statement: newStatement } });
    return { ...problem, statement: newStatement };
  }

  return problem;
}

export async function createProblem(data: {
  title: string;
  slug: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  note: string;
  difficulty: string;
  tags: string[];
  timeLimitMs: number;
  memoryLimitMb: number;
  createdBy: number;
  testcases: { input: string; expectedOutput: string; isHidden: boolean }[];
}) {
  const { testcases, ...rest } = data;
  return prisma.problem.create({
    data: { ...rest, source: 'local', testcases: { create: testcases } },
    include: { testcases: true },
  });
}
