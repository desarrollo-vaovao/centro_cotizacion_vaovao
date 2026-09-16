import { getCsrfToken } from './csrfToken.js';
import { notifySessionExpired } from './sessionExpired.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const NO_SESSION_EXPIRY_PATHS = ['/auth/login', '/auth/change-password'];

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (MUTATING_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    const error = new Error((data && data.error) || `Error ${res.status}`);
    error.status = res.status;
    if (res.status === 401 && !NO_SESSION_EXPIRY_PATHS.some((p) => path.startsWith(p))) {
      notifySessionExpired();
    }
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' })
};
