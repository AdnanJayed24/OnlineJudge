import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { registerHandler, loginHandler, logoutHandler, meHandler, refreshHandler } from '../controllers/auth.controller';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', registerHandler);
  app.post('/login',    loginHandler);
  app.post('/logout',   logoutHandler);
  app.post('/refresh',  refreshHandler);
  app.get('/me', { preHandler: authenticate }, meHandler);
}
