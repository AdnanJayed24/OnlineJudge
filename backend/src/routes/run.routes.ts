import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { runCodeHandler } from '../controllers/run.controller';

export async function runRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: authenticate }, runCodeHandler);
}
