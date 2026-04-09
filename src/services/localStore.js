const getRuntimeApiBase = () => {
  const runtime = typeof window !== 'undefined' ? window.__AAC_CONFIG__ : undefined;
  const runtimeValue = runtime?.API_BASE_URL;
  const envValue = import.meta.env.VITE_API_BASE_URL;
  const base = runtimeValue || envValue || '/api';
  return String(base).replace(/\/$/, '');
};

const API_BASE = getRuntimeApiBase();
const TOKEN_KEY = 'aac_auth_token';

const emptyState = {
  orders: [],
  dieselEntries: [],
  logs: [],
  rawStock: {},
  finishedStock: {},
};

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);

export const setAuthToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

const requestJSON = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });
  let payload = null;

  try {
    payload = await response.json();
  } catch (_err) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
};

export const login = async ({ username, password }) => {
  const payload = await requestJSON(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!payload?.token || !payload?.user) {
    throw new Error('Login failed. Invalid response.');
  }

  setAuthToken(payload.token);
  return payload.user;
};

export const getCurrentUser = async () => {
  const payload = await requestJSON(`${API_BASE}/auth/me`);
  if (!payload?.user) {
    throw new Error('No active session.');
  }
  return payload.user;
};

export const loadInitialState = async () => {
  try {
    const state = await requestJSON(`${API_BASE}/state`);
    return {
      orders: state.orders ?? [],
      dieselEntries: state.dieselEntries ?? [],
      logs: state.logs ?? [],
      rawStock: state.rawStock ?? {},
      finishedStock: state.finishedStock ?? {},
    };
  } catch (_err) {
    return emptyState;
  }
};

export const loadOrders = async () => {
  const payload = await requestJSON(`${API_BASE}/orders`);
  return payload?.orders ?? [];
};

export const createOrder = async (orderPayload) => {
  const payload = await requestJSON(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  });
  return payload?.order;
};

export const updateOrder = async (orderId, updates) => {
  const payload = await requestJSON(`${API_BASE}/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return payload?.order;
};

export const transitionOrder = async (orderId, toStatus, data = {}) => {
  const payload = await requestJSON(`${API_BASE}/orders/${orderId}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStatus, data }),
  });
  return payload?.order;
};

export const uploadInvoice = async (orderId, file) => {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/orders/${orderId}/documents/invoice`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_err) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload?.order;
};

export const deleteOrder = async (orderId) => {
  return requestJSON(`${API_BASE}/orders/${orderId}`, {
    method: 'DELETE',
  });
};

const updateRemoteState = async (key, value) => requestJSON(`${API_BASE}/state/${key}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ value }),
});

const saveAndSync = (key) => (value) => updateRemoteState(key, value).catch(() => undefined);

export const saveOrders = saveAndSync('orders');
export const saveDieselEntries = saveAndSync('dieselEntries');
export const saveLogs = saveAndSync('logs');
export const saveRawStock = saveAndSync('rawStock');
export const saveFinishedStock = saveAndSync('finishedStock');
