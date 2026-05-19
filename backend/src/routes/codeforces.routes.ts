import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { syncContestHandler, syncProblemsetHandler } from '../controllers/codeforces.controller';

export async function codeforcesRoutes(app: FastifyInstance) {
  app.post('/sync/contest',    { preHandler: authenticate }, syncContestHandler);
  app.post('/sync/problemset', { preHandler: authenticate }, syncProblemsetHandler);
}
