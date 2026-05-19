import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE as string;

const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

let refreshing: Promise<void> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retried) {
      return Promise.reject(error);
    }
    original._retried = true;

    if (!refreshing) {
      refreshing = axios
        .post(`${BASE}/auth/refresh`, {}, { withCredentials: true })
        .then(() => { refreshing = null; })
        .catch((e) => { refreshing = null; return Promise.reject(e); });
    }

    try {
      await refreshing;
      return api(original);
    } catch {
      return Promise.reject(error);
    }
  },
);

export default api;
