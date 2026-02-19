require("dotenv").config();

const { Worker } = require("bullmq");
const { prisma } = require("../db/prisma");
const {
  emitSubmissionUpdate,
  markExternalSubmissionFinal,
  markSubmissionRuntimeError,
} = require("../services/judge.service");
const { updateSubmissionExecutionMeta } = require("../services/submissions.service");
const {
  SUBMISSION_JOB_NAME,
  SUBMISSION_QUEUE_NAME,
  enqueueSubmissionJob,
} = require("../queue/submission.queue");
const { getRedisConnection, closeRedisConnection } = require("../queue/connection");
const { executeJudge } = require("../judges/judge-router");

async function startWorker() {
  await prisma.$connect();

  const worker = new Worker(
    SUBMISSION_QUEUE_NAME,
    async (job) => {
      if (job.name !== SUBMISSION_JOB_NAME) return;
      const submissionId = Number(job.data?.submissionId);
      if (!Number.isInteger(submissionId)) {
        throw new Error("INVALID_SUBMISSION_ID");
      }
      const providerName = String(job.data?.providerName || "local");
      const executionMeta = job.data?.executionMeta || {};
      try {
        const execution = await executeJudge({
          submissionId,
          providerName,
          executionMeta,
          logger: console,
        });

        if (!execution || execution.state === "final") {
          if (execution?.externalSubmissionId || execution?.externalVerdict) {
            await updateSubmissionExecutionMeta(submissionId, {
              externalSubmissionId: execution.externalSubmissionId,
              externalVerdict: execution.externalVerdict,
            });
            await emitSubmissionUpdate(submissionId);
          }
          if (execution?.status === "RUNTIME_ERROR") {
            await markSubmissionRuntimeError(
              submissionId,
              execution.errorReason || "PROVIDER_FINAL_RUNTIME_ERROR"
            );
            return;
          }
          if (
            execution?.status === "ACCEPTED" ||
            execution?.status === "WRONG_ANSWER"
          ) {
            await markExternalSubmissionFinal({
              submissionId,
              verdict: execution.status,
              runtimeMs: execution.runtimeMs ?? null,
              detailsJson: execution.details ?? null,
            });
            return;
          }
          return;
        }

        if (execution.state === "pending") {
          const pollAttempt = Number(executionMeta.pollAttempt || 0) + 1;
          await updateSubmissionExecutionMeta(submissionId, {
            status: "RUNNING",
            externalSubmissionId: execution.externalSubmissionId,
            externalVerdict: execution.externalVerdict || "RUNNING",
          });
          await emitSubmissionUpdate(submissionId);

          await enqueueSubmissionJob(submissionId, providerName, {
            delayMs: execution.nextPollMs || 3000,
            jobId: `submission:${submissionId}:poll:${pollAttempt}`,
            executionMeta: {
              pollAttempt,
              externalSubmissionId: execution.externalSubmissionId,
            },
          });
          return;
        }
      } catch (error) {
        console.error(
          `[worker] provider failed provider=${providerName} submission=${submissionId}`,
          error
        );
        await markSubmissionRuntimeError(submissionId, "PROVIDER_FAILED");
        throw error;
      }
    },
    { connection: getRedisConnection() }
  );

  worker.on("ready", () => {
    console.log(`[worker] listening queue=${SUBMISSION_QUEUE_NAME}`);
  });

  worker.on("completed", (job) => {
    console.log(`[worker] completed job=${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[worker] failed job=${job?.id}`, error);
  });

  const shutdown = async () => {
    try {
      await worker.close();
      await prisma.$disconnect();
      await closeRedisConnection();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker().catch(async (error) => {
  console.error("[worker] startup failed", error);
  await prisma.$disconnect();
  await closeRedisConnection();
  process.exit(1);
});
