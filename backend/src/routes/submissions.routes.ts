import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { submitHandler, getSubmissionHandler, listSubmissionsHandler } from '../controllers/submissions.controller';

export async function submissionRoutes(app: FastifyInstance) {
  app.post('/',    { preHandler: authenticate }, submitHandler);
  app.get('/:id', { preHandler: authenticate }, getSubmissionHandler);
  app.get('/',    { preHandler: authenticate }, listSubmissionsHandler);
}
