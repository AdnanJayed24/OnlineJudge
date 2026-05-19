import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { env } from './config/env';
import { authRoutes } from './routes/auth.routes';
import { problemRoutes } from './routes/problems.routes';
import { submissionRoutes } from './routes/submissions.routes';
import { runRoutes } from './routes/run.routes';
import { codeforcesRoutes } from './routes/codeforces.routes';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: env.FRONTEND_ORIGIN, credentials: true });
  app.register(cookie);

  app.register(authRoutes,       { prefix: '/api/auth' });
  app.register(problemRoutes,    { prefix: '/api/problems' });
  app.register(submissionRoutes, { prefix: '/api/submissions' });
  app.register(runRoutes,         { prefix: '/api/run' });
  app.register(codeforcesRoutes,  { prefix: '/api/codeforces' });

  return app;
}
