const { prisma } = require("../db/prisma");
const { getIO } = require("../sockets/io");

async function emitSubmissionUpdate(submissionId) {
  const io = getIO();
  if (!io) return;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      userId: true,
      problemId: true,
      language: true,
      status: true,
      createdAt: true,
    },
  });

  if (!submission) return;
  io.to(`submission:${submissionId}`).emit("submission:update", submission);
}

function scheduleFakeJudge(submissionId, logger) {
  setTimeout(async () => {
    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "RUNNING" },
      });
      await emitSubmissionUpdate(submissionId);
    } catch (error) {
      logger.error({ error, submissionId }, "failed to set RUNNING status");
    }
  }, 1000);

  setTimeout(async () => {
    const verdicts = ["ACCEPTED", "WRONG_ANSWER", "RUNTIME_ERROR"];
    const finalStatus = verdicts[Math.floor(Math.random() * verdicts.length)];

    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: finalStatus },
      });
      await emitSubmissionUpdate(submissionId);
    } catch (error) {
      logger.error({ error, submissionId }, "failed to set final status");
    }
  }, 3000);
}

module.exports = { scheduleFakeJudge, emitSubmissionUpdate };
