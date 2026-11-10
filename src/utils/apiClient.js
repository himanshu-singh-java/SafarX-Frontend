import axios from 'axios';
import { getAuthToken, clearAuthToken, AUTH_UNAUTHORIZED_EVENT } from './auth';

/**
 * SafarX Centralized API Client (Axios)
 * Handles automatic JWT Bearer token injection and global 401 error / token cleanup.
 */
const apiClient = axios.create({
  baseURL: 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Bearer JWT token if present in localStorage
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

// Response Interceptor: Auto-cleanup and redirect strictly on 401 Unauthorized (expired/invalid JWT)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    const errorData = error.response ? error.response.data : '';
    const errText =
      typeof errorData === 'string'
        ? errorData.toLowerCase()
        : (errorData?.message || '').toLowerCase();

    // 401 strictly indicates session expiration or invalid credentials.
    // 403 Forbidden is a business/permission rejection (e.g. role restriction or profile already completed)
    // and must NEVER wipe the user's active session!
    const isSessionExpired =
      status === 401 ||
      (status !== 403 &&
        (errText.includes('jwt expired') ||
          errText.includes('invalid jwt') ||
          errText.includes('token expired')));

    // If request explicitly marked as silentAuth (e.g. background non-blocking profile sync),
    // do not trigger disruptive popups or clear the active session.
    if (error.config?.silentAuth) {
      return Promise.reject(error);
    }

    if (isSessionExpired) {
      console.warn('[apiClient] 401 Unauthorized detected. Clearing expired session.');
      // 1. Clear all localStorage auth and user data
      clearAuthToken();

      // 2. Dispatch unauthorized event for reactive UI state
      window.dispatchEvent(
        new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
          detail: { status: 401, error: errorData },
        })
      );

      // 3. Redirect to /login
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

