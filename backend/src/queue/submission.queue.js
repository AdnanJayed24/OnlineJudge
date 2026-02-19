const { Queue } = require("bullmq");
const { getRedisConnection } = require("./connection");

const SUBMISSION_QUEUE_NAME = "submission-judge";
const SUBMISSION_JOB_NAME = "judge-submission";

let queue;

function getSubmissionQueue() {
  if (!queue) {
    queue = new Queue(SUBMISSION_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });
  }
  return queue;
}

async function enqueueSubmissionJob(
  submissionId,
  providerName = "local",
  options = {}
) {
  const { delayMs = 0, executionMeta = {}, jobId = `submission:${submissionId}` } = options;
  const submissionQueue = getSubmissionQueue();
  await submissionQueue.add(
    SUBMISSION_JOB_NAME,
    { submissionId, providerName, executionMeta },
    {
      jobId,
      delay: Math.max(0, Number(delayMs) || 0),
    }
  );
}

async function closeSubmissionQueue() {
  if (!queue) return;
  await queue.close();
  queue = null;
}

module.exports = {
  SUBMISSION_QUEUE_NAME,
  SUBMISSION_JOB_NAME,
  getSubmissionQueue,
  enqueueSubmissionJob,
  closeSubmissionQueue,
};
