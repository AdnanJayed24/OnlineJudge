import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
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
        .post('http://localhost:3000/api/auth/refresh', {}, { withCredentials: true })
        .then(() => { refreshing = null; })
        .catch((e) => { refreshing = null; return Promise.reject(e); });
    }

    try {
      await refreshing;
      return api(original);
    } catch {
      // refresh failed — let caller handle the 401
      return Promise.reject(error);
    }
  },
);

export default api;
