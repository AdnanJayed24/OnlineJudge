const localProvider = require("./providers/local.provider");
const codeforcesProvider = require("./providers/codeforces.provider");

const providers = new Map([
  [localProvider.name, localProvider],
  [codeforcesProvider.name, codeforcesProvider],
]);

function resolveProvider(providerName) {
  if (!providerName) return localProvider;
  return providers.get(providerName) || localProvider;
}

async function executeJudge({
  submissionId,
  providerName,
  executionMeta = {},
  logger,
}) {
  const provider = resolveProvider(providerName);
  return provider.execute({ submissionId, executionMeta, logger });
}

module.exports = {
  executeJudge,
};
