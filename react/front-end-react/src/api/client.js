// Direct port of front-end/assets/js/api-client.js — same base URL, same
// localStorage session key, same request/response contract.

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

// Same-origin requests work in production behind a reverse proxy and on any
// device. Vite proxies /api to the local Nest server during development.
export const API_BASE = configuredApiBase || '/api';
export const SESSION_KEY = 'deliverysync-session-v1';
export const SESSION_CHANGED_EVENT = 'deliverysync:session-changed';
const DATA_CHANGED_EVENT = 'deliverysync:data-changed';
const DATA_CHANGED_STORAGE_KEY = 'deliverysync-data-changed-v1';
const DATA_CHANGED_CHANNEL = 'deliverysync-data-v1';

function announceDataChange(method, endpoint) {
  const detail = { method, endpoint, at: Date.now() };

  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail }));

  try {
    localStorage.setItem(DATA_CHANGED_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Cross-tab sync is an enhancement; the API mutation already succeeded.
  }

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(DATA_CHANGED_CHANNEL);
    channel.postMessage(detail);
    channel.close();
  }
}

export function getSession() {
  try {
    const active = sessionStorage.getItem(SESSION_KEY);
    if (active) return JSON.parse(active);
    const role = window.location.pathname.split('/')[1];
    if (!['superuser', 'fleet-manager', 'business-client', 'driver'].includes(role)) return null;
    const remembered = localStorage.getItem(`${SESSION_KEY}:${role}`);
    if (remembered) sessionStorage.setItem(SESSION_KEY, remembered);
    return JSON.parse(remembered || 'null');
  } catch {
    return null;
  }
}

export function setSession(session) {
  const serialized = JSON.stringify(session);
  // The active account belongs to this tab. Remembered accounts are stored
  // separately by role, so signing into another portal cannot replace it.
  sessionStorage.setItem(SESSION_KEY, serialized);
  if (session?.remembered === false) {
    localStorage.removeItem(`${SESSION_KEY}:${session.role}`);
  } else {
    localStorage.setItem(`${SESSION_KEY}:${session.role}`, serialized);
  }
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}

export function clearSession() {
  const session = getSession();
  if (session?.role) localStorage.removeItem(`${SESSION_KEY}:${session.role}`);
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}

export function getCurrentToken() {
  return getSession()?.token || '';
}

export function getCurrentRole() {
  return getSession()?.role || '';
}

export function getCurrentUserId() {
  return getSession()?.userId || '';
}

export function getHeaders(isFormData = false) {
  const headers = {};
  const token = getCurrentToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

export async function apiRequest(method, endpoint, body = null) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const options = {
    method,
    headers: getHeaders(isFormData),
    cache: 'no-store',
  };

  if (body && method !== 'GET') {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, options);
  } catch {
    const error = new Error('Cannot connect to the server. Check your connection and try again.');
    error.status = 0;
    throw error;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && getCurrentToken()) {
      clearSession();
    }
    console.error(`API Error [${response.status}]:`, data?.message || data);
    const message = [502, 503, 504].includes(response.status)
      ? 'The server is temporarily unavailable. Please try again shortly.'
      : data?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (method !== 'GET') {
    announceDataChange(method, endpoint);
  }

  return data;
}

export async function apiFileRequest(endpoint) {
  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });
  } catch {
    const error = new Error('Cannot connect to the server. Check your connection and try again.');
    error.status = 0;
    throw error;
  }

  if (!response.ok) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    const error = new Error(data?.message || `File request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.blob();
}

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export { qs };
