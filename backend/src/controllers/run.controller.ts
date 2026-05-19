import type { FastifyRequest, FastifyReply } from 'fastify';
import { pistonRun, type Language } from '../lib/piston';

export async function runCodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { language, sourceCode, stdin } = req.body as { language: Language; sourceCode: string; stdin?: string };
  try {
    const result = await pistonRun(language, sourceCode, stdin ?? '');
    return result;
  } catch (err: unknown) {
    return reply.status(422).send({ error: (err as Error).message });
  }
}
