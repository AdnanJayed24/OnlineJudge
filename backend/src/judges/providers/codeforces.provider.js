const { getSubmissionById } = require("../../services/submissions.service");
const { submitToCodeforces } = require("../../services/codeforces.service");

async function execute({ submissionId, executionMeta = {}, logger }) {
  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    return {
      state: "final",
      status: "RUNTIME_ERROR",
      errorReason: "SUBMISSION_NOT_FOUND",
    };
  }

  return submitToCodeforces({ submission, executionMeta, logger });
}

module.exports = {
  name: "codeforces",
  execute,
};
