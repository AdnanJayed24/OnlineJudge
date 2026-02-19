import { apiClient } from "./apiClient";
import { clearAccessToken, setAccessToken } from "./tokenStore";

export async function register(payload) {
  const response = await apiClient.post("/auth/register", payload);
  setAccessToken(response.data.accessToken);
  return response.data;
}

export async function login(payload) {
  const response = await apiClient.post("/auth/login", payload);
  setAccessToken(response.data.accessToken);
  return response.data;
}

export async function me() {
  const response = await apiClient.get("/auth/me");
  return response.data.user;
}

export async function logout() {
  await apiClient.post("/auth/logout");
  clearAccessToken();
}
