import axios from "axios";
import { clearAccessToken, getAccessToken, setAccessToken } from "./tokenStore";
import { API_BASE_URL } from "./runtimeConfig";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let queue = [];

function flushQueue(token) {
  queue.forEach((cb) => cb(token));
  queue = [];
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url || "";

    // Never try to refresh from refresh endpoint itself.
    if (requestUrl.includes("/auth/refresh")) {
      clearAccessToken();
      return Promise.reject(error);
    }

    if (status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push((token) => {
          if (!token) {
            reject(error);
            return;
          }
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshResponse = await apiClient.post("/auth/refresh");
      const newToken = refreshResponse.data.accessToken;
      setAccessToken(newToken);
      flushQueue(newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearAccessToken();
      flushQueue(null);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
