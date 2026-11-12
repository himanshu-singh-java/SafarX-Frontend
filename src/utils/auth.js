/**
 * SafarX Tab-Isolated Authentication & JWT Utilities
 * Prioritizes tab-scoped sessionStorage so multiple tabs (Rider, Driver, Admin)
 * can run simultaneously in the same browser without overwriting each other's credentials!
 */

export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

// Keys that are strictly tab-isolated so Rider, Driver, and Admin never cross-contaminate
const TAB_SCOPED_KEYS = new Set([
  'jwtToken',
  'token',
  'userEmail',
  'userName',
  'userRole',
  'driverId',
  'riderId',
  'userPhone',
  'profileCompleted',
  'driverVehicleType',
  'driverVehicleModel',
  'driverPlateNumber',
]);

/**
 * Authoritative user name resolver based on verified credentials & database mapping.
 * Eliminates cross-tab naming race conditions permanently without hardcoded identities.
 */
export const resolveUserName = (rawName, email) => {
  const cleanName = (rawName || '').trim();
  if (cleanName && cleanName !== 'null' && cleanName !== 'undefined') {
    return cleanName;
  }
  const cleanEmail = (email || '').toLowerCase().trim();
  if (cleanEmail) {
    const prefix = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
    return prefix
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return 'SafarX User';
};

export const getStorageItem = (key) => {
  try {
    const sessionVal = sessionStorage.getItem(key);
    if (sessionVal && sessionVal !== 'null' && sessionVal !== 'undefined') {
      if (key === 'userName') {
        const email = sessionStorage.getItem('userEmail');
        return resolveUserName(sessionVal, email);
      }
      return sessionVal;
    }
  } catch (e) {}

  if (key === 'userName') {
    const email = sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail');
    if (email) {
      return resolveUserName(null, email);
    }
  }

  // Only fall back to localStorage for non-conflicting initial loads if sessionStorage is empty
  try {
    const localVal = localStorage.getItem(key);
    if (localVal && localVal !== 'null' && localVal !== 'undefined') {
      return localVal;
    }
  } catch (e) {}
  return null;
};

export const setStorageItem = (key, value) => {
  if (value === undefined || value === null) return;
  const strVal = String(value);

  // Tab-scoped isolation in sessionStorage
  try {
    sessionStorage.setItem(key, strVal);
  } catch (e) {}

  // Always mirror to localStorage for persistence across reloads & sessions
  try {
    localStorage.setItem(key, strVal);
  } catch (e) {}
};

export const getRiderId = () => {
  const saved = getStorageItem('riderId');
  if (saved && saved !== 'null' && saved !== 'undefined') {
    const num = Number(saved);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
};

export const removeStorageItem = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch (e) {}
  try {
    localStorage.removeItem(key);
  } catch (e) {}
};

export const getAuthToken = () => {
  const token = getStorageItem('jwtToken') || getStorageItem('token');
  if (token && token !== 'null' && token !== 'undefined') {
    return token.trim();
  }
  return null;
};

export const getUserRole = () => {
  const savedRole = getStorageItem('userRole');
  if (savedRole) return savedRole;
  const token = getAuthToken();
  if (token) {
    const decoded = parseJwt(token);
    if (decoded?.role) return decoded.role;
  }
  return 'ROLE_RIDER';
};

export const setAuthToken = (token, email = '', role = '') => {
  if (token) {
    const cleanToken = token.trim();
    setStorageItem('jwtToken', cleanToken);
    setStorageItem('token', cleanToken);
    if (!role) {
      const decoded = parseJwt(cleanToken);
      if (decoded?.role) {
        role = decoded.role;
      }
    }
  }
  if (email) {
    setStorageItem('userEmail', email.trim());
  }
  if (role) {
    setStorageItem('userRole', role.trim());
  } else if (!getStorageItem('userRole')) {
    setStorageItem('userRole', 'ROLE_RIDER');
  }
};

export const clearAuthToken = () => {
  const keys = [
    'jwtToken',
    'token',
    'userEmail',
    'userRole',
    'userName',
    'userPhone',
    'riderId',
    'driverId',
    'profileCompleted',
  ];
  keys.forEach(removeStorageItem);
};

export const getAuthHeaders = (extraHeaders = {}) => {
  const token = getAuthToken();
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const handleAuthResponse = (response) => {
  // Only 401 indicates genuine session expiration.
  // 403 Forbidden is a permission/role issue and must NOT wipe the session!
  if (response && response.status === 401) {
    clearAuthToken();
    window.dispatchEvent(
      new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
        detail: { status: response.status },
      })
    );
    return true; // handled as unauthorized
  }
  return false;
};

export const parseJwt = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};
