import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSubmission, getSubmission, listSubmissions } from '../services/submissions.service';

export async function submitHandler(req: FastifyRequest, reply: FastifyReply) {
  const { problemId, language, sourceCode } = req.body as {
    problemId: number;
    language: string;
    sourceCode: string;
  };
  try {
    const sub = await createSubmission(req.userId!, problemId, language, sourceCode);
    return reply.status(202).send(sub);
  } catch (err: unknown) {
    req.log.error(err, 'createSubmission failed');
    return reply.status(500).send({ error: 'Failed to queue submission' });
  }
}

export async function getSubmissionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const sub = await getSubmission(Number(id));
  if (!sub || sub.userId !== req.userId) return reply.status(404).send({ error: 'Not found' });
  return sub;
}

export async function listSubmissionsHandler(req: FastifyRequest, _reply: FastifyReply) {
  const { problemId } = req.query as { problemId?: string };
  return listSubmissions(req.userId!, problemId ? Number(problemId) : undefined);
}
