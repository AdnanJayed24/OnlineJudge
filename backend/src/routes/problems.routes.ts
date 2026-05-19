import type { FastifyInstance } from 'fastify';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  listProblemsHandler,
  getProblemHandler,
  createProblemHandler,
  fetchProblemHandler,
} from '../controllers/problems.controller';

export async function problemRoutes(app: FastifyInstance) {
  app.get('/',        { preHandler: optionalAuth }, listProblemsHandler);
  app.get('/:slug',                                 getProblemHandler);
  app.post('/',       { preHandler: authenticate }, createProblemHandler);
  app.post('/fetch',  { preHandler: authenticate }, fetchProblemHandler);
}
