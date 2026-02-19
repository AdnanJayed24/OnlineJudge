import { apiClient } from "./apiClient";

export async function listProblems() {
  const response = await apiClient.get("/problems/codeforces", {
    params: { limit: 150 },
  });
  return response.data.items || [];
}

export async function getProblemById(problemId) {
  const response = await apiClient.get(`/problems/codeforces/${problemId}`);
  return response.data;
}
