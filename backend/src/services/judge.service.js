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
      provider: true,
      externalSubmissionId: true,
      externalVerdict: true,
      createdAt: true,
      result: {
        select: {
          verdict: true,
          runtimeMs: true,
          detailsJson: true,
        },
      },
    },
  });

  if (!submission) return;
  io.to(`submission:${submissionId}`).emit("submission:update", submission);
}

function normalizeOutput(value) {
  return String(value ?? "").trim().replace(/\r\n/g, "\n");
}

function getOutputMarkersFromSource(sourceCode) {
  const regex = /^\s*\/\/\s*OUTPUT\s*:\s*(.*)$/gm;
  const markers = [];
  let match;
  while ((match = regex.exec(sourceCode)) !== null) {
    markers.push(match[1]);
  }
  return markers;
}

async function markSubmissionRuntimeError(
  submissionId,
  reason = "JUDGE_EXCEPTION"
) {
  const verdict = "RUNTIME_ERROR";
  await prisma.submissionResult.upsert({
    where: { submissionId },
    update: {
      verdict,
      runtimeMs: 0,
      detailsJson: [{ status: reason }],
    },
    create: {
      submissionId,
      verdict,
      runtimeMs: 0,
      detailsJson: [{ status: reason }],
    },
  });
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: verdict },
  });
  await emitSubmissionUpdate(submissionId);
}

async function markExternalSubmissionFinal({
  submissionId,
  verdict,
  runtimeMs = null,
  detailsJson = null,
}) {
  await prisma.submissionResult.upsert({
    where: { submissionId },
    update: {
      verdict,
      runtimeMs,
      detailsJson,
    },
    create: {
      submissionId,
      verdict,
      runtimeMs,
      detailsJson,
    },
  });
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: verdict },
  });
  await emitSubmissionUpdate(submissionId);
}

async function runDeterministicJudge(submissionId, logger) {
  try {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "RUNNING" },
    });
    await emitSubmissionUpdate(submissionId);

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        problem: {
          include: {
            testcases: {
              orderBy: { id: "asc" },
            },
          },
        },
      },
    });

    if (!submission) {
      return;
    }

    const testcases = submission.problem?.testcases || [];
    if (testcases.length === 0) {
      const verdict = "RUNTIME_ERROR";
      await prisma.submissionResult.upsert({
        where: { submissionId },
        update: {
          verdict,
          runtimeMs: 0,
          detailsJson: [{ status: "NO_TESTCASES" }],
        },
        create: {
          submissionId,
          verdict,
          runtimeMs: 0,
          detailsJson: [{ status: "NO_TESTCASES" }],
        },
      });

      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: verdict },
      });
      await emitSubmissionUpdate(submissionId);
      return;
    }

    const markers = getOutputMarkersFromSource(submission.sourceCode);
    const details = testcases.map((testcase, index) => ({
      testcaseId: testcase.id,
      index: index + 1,
      status: "QUEUED",
    }));
    let verdict = "ACCEPTED";
    const startedAt = Date.now();

    await prisma.submissionResult.upsert({
      where: { submissionId },
      update: { verdict: "RUNNING", runtimeMs: null, detailsJson: details },
      create: { submissionId, verdict: "RUNNING", runtimeMs: null, detailsJson: details },
    });
    await emitSubmissionUpdate(submissionId);

    for (let index = 0; index < testcases.length; index += 1) {
      const testcase = testcases[index];
      const producedOutput = markers[index] || "";
      const expectedOutput = testcase.expectedOutput;
      const passed =
        normalizeOutput(producedOutput) === normalizeOutput(expectedOutput);

      details[index] = {
        testcaseId: testcase.id,
        index: index + 1,
        status: passed ? "PASSED" : "FAILED",
      };

      await prisma.submissionResult.update({
        where: { submissionId },
        data: {
          verdict: "RUNNING",
          runtimeMs: Date.now() - startedAt,
          detailsJson: details,
        },
      });
      await emitSubmissionUpdate(submissionId);

      if (!passed) {
        verdict = "WRONG_ANSWER";
        break;
      }
    }

    const runtimeMs = Date.now() - startedAt;
    await prisma.submissionResult.upsert({
      where: { submissionId },
      update: { verdict, runtimeMs, detailsJson: details },
      create: { submissionId, verdict, runtimeMs, detailsJson: details },
    });

    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: verdict },
    });
    await emitSubmissionUpdate(submissionId);
  } catch (error) {
    logger.error({ error, submissionId }, "judge execution failed");
    try {
      await markSubmissionRuntimeError(submissionId, "JUDGE_EXCEPTION");
    } catch (innerError) {
      logger.error(
        { innerError, submissionId },
        "failed to persist runtime error verdict"
      );
    }
  }
}

function scheduleSubmissionJudge(submissionId, logger) {
  setTimeout(() => {
    runDeterministicJudge(submissionId, logger);
  }, 300);
}

module.exports = {
  scheduleSubmissionJudge,
  emitSubmissionUpdate,
  runDeterministicJudge,
  markSubmissionRuntimeError,
  markExternalSubmissionFinal,
};
