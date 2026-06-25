const getRuntimeConfig = () => (typeof window !== 'undefined' ? (window.__AAC_CONFIG__ || {}) : {});

const getRuntimeApiBase = () => {
  const runtimeValue = getRuntimeConfig().API_BASE_URL;
  const envValue = import.meta.env.VITE_API_BASE_URL;
  const base = runtimeValue || envValue || '/api';
  return String(base).replace(/\/$/, '');
};

const getApiBase = () => getRuntimeApiBase();
const buildApiUrl = (path) => `${getApiBase()}${path}`;
const TOKEN_KEY = 'aac_auth_token';

const looksLikeHtml = (text = '') => /<!doctype html|<html[\s>]/iu.test(String(text).trimStart().slice(0, 400));

const buildApiMisrouteMessage = (url, contentType = '') => {
  const configuredBase = getApiBase();
  const normalizedType = contentType || 'unknown content-type';
  return `API misconfiguration: ${url} returned ${normalizedType} instead of JSON. Set runtime-config.js API_BASE_URL to your backend /api URL (current: ${configuredBase}).`;
};

const normalizeOrder = (order = {}) => ({
  ...order,
  invoiceId: order?.invoiceId ?? order?.invoiceNumber ?? '',
  status: order?.status || 'Awaiting Truck',
  invoice: order?.invoice ?? null,
  dispatchSlip: order?.dispatchSlip ?? null,
});

const normalizeOrders = (orders = []) =>
  (Array.isArray(orders) ? orders : []).map((order) => normalizeOrder(order));

const normalizeRate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildClientProfilesFromOrders = (orders = [], query = '') => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const byClient = new Map();

  (Array.isArray(orders) ? orders : [])
    .slice()
    .sort((a, b) => {
      const aKey = String(a?.updatedAt || a?.createdAt || a?.orderDate || '');
      const bKey = String(b?.updatedAt || b?.createdAt || b?.orderDate || '');
      return bKey.localeCompare(aKey);
    })
    .forEach((order) => {
      const clientName = String(order?.client || '').trim();
      if (!clientName) return;

      if (normalizedQuery && !clientName.toLowerCase().includes(normalizedQuery)) return;

      const clientKey = clientName.toLowerCase();
      if (!byClient.has(clientKey)) {
        byClient.set(clientKey, {
          clientName,
          gstin: String(order?.gstin || '').trim(),
          sites: new Map(),
        });
      }

      const profile = byClient.get(clientKey);
      if (!profile.gstin) {
        profile.gstin = String(order?.gstin || '').trim();
      }

      const siteName = String(order?.location || '').trim();
      if (!siteName) return;

      const siteKey = siteName.toLowerCase();
      if (profile.sites.has(siteKey)) return;

      profile.sites.set(siteKey, {
        siteName,
        aacRate: normalizeRate(order?.rate),
        bjmRate: normalizeRate(order?.bjmRate),
        lastUsedAt: String(order?.updatedAt || order?.createdAt || order?.orderDate || ''),
      });
    });

  return Array.from(byClient.values())
    .map((profile) => ({
      clientName: profile.clientName,
      gstin: profile.gstin,
      sites: Array.from(profile.sites.values()).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt)),
    }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));
};

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);

export const setAuthToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('aac_auth_user'); // keep removal just in case it's there
};

const requestJSON = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (_fetchError) {
    const configuredBase = getApiBase();
    const message = `Cannot reach API at ${configuredBase}. Update runtime-config.js API_BASE_URL to your backend /api URL.`;
    const error = new Error(message);
    error.statusCode = 0;
    error.url = url;
    throw error;
  }

  let payload = null;
  let rawText = '';
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch (_err) {
      payload = null;
    }
  } else {
    try {
      rawText = await response.text();
    } catch (_err) {
      rawText = '';
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
    }

    let message = payload?.message || (!looksLikeHtml(rawText) && rawText ? rawText.trim().slice(0, 300) : '') || `Request failed with status ${response.status}`;
    // Include error details from PHP backend if available
    if (payload?.details && typeof payload.details === 'string' && payload.details.trim() !== '') {
      message = message + ' (' + payload.details.trim().slice(0, 200) + ')';
    }
    const error = new Error(message);
    error.statusCode = response.status;
    error.url = url;
    throw error;
  }

  if (!contentType.includes('application/json')) {
    const message = looksLikeHtml(rawText)
      ? buildApiMisrouteMessage(url, contentType || 'text/html')
      : `Unexpected API response format from ${url}: ${contentType || 'unknown content-type'}.`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.url = url;
    throw error;
  }

  if (!payload || typeof payload !== 'object') {
    const error = new Error(`Unexpected empty API response from ${url}.`);
    error.statusCode = response.status;
    error.url = url;
    throw error;
  }

  return payload;
};

export const login = async ({ username, password }) => {
  const payload = await requestJSON(buildApiUrl('/auth/login'), {
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
  if (!getAuthToken()) {
    throw new Error('No active session.');
  }

  const payload = await requestJSON(buildApiUrl('/auth/me'));
  if (!payload?.user) {
    throw new Error('No active session.');
  }
  return payload.user;
};

export const loadInitialState = async () => {
  const state = await requestJSON(buildApiUrl('/state'));
  return {
    orders: state.orders ?? [],
    dieselEntries: state.dieselEntries ?? [],
    logs: state.logs ?? [],
    rawStock: state.rawStock ?? {},
    finishedStock: state.finishedStock ?? {},
  };
};

export const loadOrders = async () => {
  const payload = await requestJSON(buildApiUrl('/orders'));
  return normalizeOrders(payload?.orders ?? []);
};

export const searchClientProfiles = async (query = '') => {
  const normalizedQuery = String(query || '').trim();

  try {
    const payload = await requestJSON(buildApiUrl(`/orders/client-profiles?q=${encodeURIComponent(normalizedQuery)}`));
    return Array.isArray(payload?.profiles) ? payload.profiles : [];
  } catch (error) {
    if (error?.statusCode === 404) {
      const orders = await loadOrders();
      return buildClientProfilesFromOrders(orders, normalizedQuery);
    }

    throw error;
  }
};

export const createOrder = async (orderPayload) => {
  const payload = await requestJSON(buildApiUrl('/orders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  });
  return normalizeOrder(payload?.order);
};

export const updateOrder = async (orderId, updates) => {
  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return normalizeOrder(payload?.order);
};

export const updateDispatchedOrder = async (orderId, updates) => {
  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}/dispatched-edit`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return normalizeOrder(payload?.order);
};

export const transitionOrder = async (orderId, toStatus, data = {}) => {
  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}/transition`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStatus, data }),
  });
  return normalizeOrder(payload?.order);
};

export const dispatchOrder = async (orderId, data = {}) => {
  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}/dispatch`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return normalizeOrder(payload?.order);
};

export const generateMtc = async (orderId, testData = {}) => {
  let payload;
  try {
    payload = await requestJSON(buildApiUrl(`/orders/${orderId}/mtc`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    });
  } catch (error) {
    if (error?.statusCode !== 404) {
      throw error;
    }

    // Compatibility fallback for older API route shape.
    payload = await requestJSON(buildApiUrl(`/orders/${orderId}/documents/mtc`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    });
  }

  return normalizeOrder(payload?.order);
};

export const uploadInvoice = async (orderId, file) => {
  const formData = new FormData();
  formData.append('file', file);

  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}/documents/invoice`), {
    method: 'POST',
    body: formData,
  });

  return normalizeOrder(payload?.order);
};

export const deleteOrder = async (orderId) => {
  return requestJSON(buildApiUrl(`/orders/${orderId}`), {
    method: 'DELETE',
  });
};

const updateRemoteState = async (key, value) => {
  return requestJSON(buildApiUrl(`/state/${key}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
};

const saveAndSync = (key) => async (value) => {
  try {
    await updateRemoteState(key, value);
  } catch (error) {
    console.error(`Failed to sync ${key}:`, error);
  }
};

export const saveOrders = saveAndSync('orders');
export const saveDieselEntries = saveAndSync('dieselEntries');
export const saveLogs = saveAndSync('logs');
export const saveRawStock = saveAndSync('rawStock');
export const saveFinishedStock = saveAndSync('finishedStock');

// Production stock API endpoints (direct to backend, not legacy state)
export const updateRawStockDay = async (date, items) => {
  return requestJSON(buildApiUrl(`/production/raw/${date}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
};

export const updateFinishedStockDay = async (date, data) => {
  return requestJSON(buildApiUrl(`/production/finished/${date}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const getRawStockDay = async (date) => {
  try {
    return await requestJSON(buildApiUrl(`/production/raw/${date}`));
  } catch (error) {
    if (error?.statusCode === 404) {
      return null;
    }
    throw error;
  }
};

export const getFinishedStockDay = async (date) => {
  try {
    return await requestJSON(buildApiUrl(`/production/finished/${date}`));
  } catch (error) {
    if (error?.statusCode === 404) {
      return null;
    }
    throw error;
  }
};

export const resetProductionStock = async () => {
  return requestJSON(buildApiUrl('/production/reset'), {
    method: 'DELETE',
  });
};