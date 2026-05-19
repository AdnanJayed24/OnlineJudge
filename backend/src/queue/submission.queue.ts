import { Queue } from 'bullmq';
import { getBullMQConnection } from './connection';

export const QUEUE_NAME = 'submissions';
export const JOB_NAME  = 'judge';

let queue: Queue | null = null;

function getQueue(): Queue {
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: getBullMQConnection() });
  return queue;
}

export async function enqueueSubmission(submissionId: number): Promise<void> {
  await getQueue().add(JOB_NAME, { submissionId }, { jobId: `sub-${submissionId}` });
}
