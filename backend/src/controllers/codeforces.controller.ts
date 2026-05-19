import type { FastifyRequest, FastifyReply } from 'fastify';
import { syncByContest, syncByProblemset } from '../services/codeforces.service';

export async function syncContestHandler(req: FastifyRequest, reply: FastifyReply) {
  if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Forbidden' });

  const { contestId } = req.body as { contestId: number };
  if (!contestId) return reply.status(400).send({ error: 'contestId required' });

  try {
    const result = await syncByContest(Number(contestId));
    return result;
  } catch (err: unknown) {
    return reply.status(502).send({ error: (err as Error).message });
  }
}

export async function syncProblemsetHandler(req: FastifyRequest, reply: FastifyReply) {
  if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Forbidden' });

  const { tags, minRating, maxRating, limit } = req.body as {
    tags?:      string[];
    minRating?: number;
    maxRating?: number;
    limit?:     number;
  };

  try {
    const result = await syncByProblemset({ tags, minRating, maxRating, limit });
    return result;
  } catch (err: unknown) {
    return reply.status(502).send({ error: (err as Error).message });
  }
}
