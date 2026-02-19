const { runDeterministicJudge } = require("../../services/judge.service");

async function execute({ submissionId, logger }) {
  await runDeterministicJudge(submissionId, logger);
  return { state: "final" };
}

module.exports = {
  name: "local",
  execute,
};
