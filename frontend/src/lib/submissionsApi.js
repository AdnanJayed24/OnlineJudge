import { apiClient } from "./apiClient";

export async function listSubmissions() {
  const response = await apiClient.get("/submissions");
  return response.data.items || [];
}

export async function createSubmission(payload) {
  const response = await apiClient.post("/submissions", payload);
  return response.data;
}

export async function createCodeforcesSubmission(payload) {
  const response = await apiClient.post("/submissions/codeforces", payload);
  return response.data;
}

export async function getSubmissionById(submissionId) {
  const response = await apiClient.get(`/submissions/${submissionId}`);
  return response.data;
}

export async function getSubmissionResult(submissionId) {
  const response = await apiClient.get(`/submissions/${submissionId}/result`);
  return response.data;
}
