import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAuthToken, clearAuthToken, AUTH_UNAUTHORIZED_EVENT } from './auth';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    const errorData = error.response ? error.response.data : '';
    const errText =
      typeof errorData === 'string'
        ? errorData.toLowerCase()
        : (errorData?.message || '').toLowerCase();

    const isSessionExpired =
      status === 401 ||
      (status !== 403 &&
        (errText.includes('jwt expired') ||
          errText.includes('invalid jwt') ||
          errText.includes('token expired')));

    if (error.config?.silentAuth) {
      return Promise.reject(error);
    }

    if (isSessionExpired) {
      clearAuthToken();
      window.dispatchEvent(
        new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
          detail: { status: 401, error: errorData },
        })
      );

      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

