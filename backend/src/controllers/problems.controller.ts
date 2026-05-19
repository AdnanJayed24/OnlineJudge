import type { FastifyRequest, FastifyReply } from 'fastify';
import { listProblems, getProblem, createProblem } from '../services/problems.service';
import { syncCFProblem } from '../services/codeforces.service';
import { syncLCProblem, syncLCProblemById } from '../services/leetcode.service';

export async function listProblemsHandler(req: FastifyRequest, _reply: FastifyReply) {
  const { source, q } = req.query as { source?: string; q?: string };
  return listProblems(req.userId, { source, q });
}

export async function getProblemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { slug } = req.params as { slug: string };
  const problem = await getProblem(slug);
  if (!problem) return reply.status(404).send({ error: 'Problem not found' });
  return problem;
}

export async function createProblemHandler(req: FastifyRequest, reply: FastifyReply) {
  if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
  const body = req.body as {
    title: string;
    slug: string;
    statement: string;
    inputFormat?: string;
    outputFormat?: string;
    note?: string;
    difficulty: string;
    tags: string[];
    timeLimitMs: number;
    memoryLimitMb: number;
    testcases: { input: string; expectedOutput: string; isHidden: boolean }[];
  };
  const problem = await createProblem({
    ...body,
    inputFormat:  body.inputFormat  ?? '',
    outputFormat: body.outputFormat ?? '',
    note:         body.note         ?? '',
    createdBy: req.userId!,
  });
  return reply.status(201).send(problem);
}

export async function fetchProblemHandler(req: FastifyRequest, reply: FastifyReply) {
  if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
  const body = req.body as { platform: 'codeforces' | 'leetcode'; problemId?: string; contestId?: number; index?: string };
  try {
    if (body.platform === 'codeforces') {
      let contestId: number, index: string;
      if (body.problemId) {
        const match = body.problemId.trim().match(/^(\d+)([A-Za-z]+\d*)$/);
        if (!match) return reply.status(400).send({ error: 'Invalid CF problem ID. Use format like "1A".' });
        contestId = parseInt(match[1], 10);
        index = match[2].toUpperCase();
      } else if (body.contestId && body.index) {
        contestId = Number(body.contestId);
        index = body.index.toUpperCase();
      } else {
        return reply.status(400).send({ error: 'Provide problemId (e.g. "1A") or contestId + index' });
      }
      return reply.status(201).send(await syncCFProblem(contestId, index));
    }
    if (body.platform === 'leetcode') {
      if (!body.problemId) return reply.status(400).send({ error: 'problemId required' });
      const lcId = body.problemId.trim();
      const asNum = parseInt(lcId, 10);
      const result = Number.isInteger(asNum) && String(asNum) === lcId
        ? await syncLCProblemById(asNum)
        : await syncLCProblem(lcId);
      return reply.status(201).send(result);
    }
    return reply.status(400).send({ error: 'platform must be "codeforces" or "leetcode"' });
  } catch (err: unknown) {
    return reply.status(502).send({ error: (err as Error).message });
  }
}
