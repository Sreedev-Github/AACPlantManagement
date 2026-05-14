const getRuntimeConfig = () => (typeof window !== 'undefined' ? (window.__AAC_CONFIG__ || {}) : {});

const getRuntimeApiBase = () => {
  const runtimeValue = getRuntimeConfig().API_BASE_URL;
  const envValue = import.meta.env.VITE_API_BASE_URL;
  const base = runtimeValue || envValue || '/api';
  return String(base).replace(/\/$/, '');
};

const isLocalOnlyMode = () => {
  const runtime = getRuntimeConfig();
  if (runtime.USE_LOCAL_ONLY === true) return true;

  const apiBase = String(runtime.API_BASE_URL || '').trim().toLowerCase();
  return apiBase === 'local' || apiBase === 'local://';
};

const getApiBase = () => getRuntimeApiBase();
const buildApiUrl = (path) => `${getApiBase()}${path}`;
const TOKEN_KEY = 'aac_auth_token';

const LOCAL_STORAGE_KEYS = {
  ORDERS: 'aac_orders',
  DIESEL_ENTRIES: 'aac_diesel_entries',
  LOGS: 'aac_logs',
  RAW_STOCK: 'aac_raw_stock',
  FINISHED_STOCK: 'aac_finished_stock',
  AUTH_USER: 'aac_auth_user',
};

const DEMO_CREDENTIALS = {
  sales1: { password: 'sales123', role: 'sales' },
  loading1: { password: 'load1234', role: 'loading' },
  accounts1: { password: 'acc12345', role: 'accounts' },
  manager1: { password: 'manage123', role: 'management' },
  prod1: { password: 'prod1234', role: 'production' },
};

let legacyStateAccessBlocked = false;

const looksLikeHtml = (text = '') => /<!doctype html|<html[\s>]/iu.test(String(text).trimStart().slice(0, 400));

const buildApiMisrouteMessage = (url, contentType = '') => {
  const configuredBase = getApiBase();
  const normalizedType = contentType || 'unknown content-type';
  return `API misconfiguration: ${url} returned ${normalizedType} instead of JSON. Set runtime-config.js API_BASE_URL to your backend /api URL (current: ${configuredBase}).`;
};

const emptyState = {
  orders: [],
  dieselEntries: [],
  logs: [],
  rawStock: {},
  finishedStock: {},
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
  localStorage.removeItem(LOCAL_STORAGE_KEYS.AUTH_USER);
};

const readLocalJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (_error) {
    return fallback;
  }
};

const writeLocalJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const generateLocalId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const localLoadOrders = () => readLocalJson(LOCAL_STORAGE_KEYS.ORDERS, []);
const localSaveOrders = (orders) => writeLocalJson(LOCAL_STORAGE_KEYS.ORDERS, orders);

const localLoadState = () => ({
  dieselEntries: readLocalJson(LOCAL_STORAGE_KEYS.DIESEL_ENTRIES, []),
  logs: readLocalJson(LOCAL_STORAGE_KEYS.LOGS, []),
  rawStock: readLocalJson(LOCAL_STORAGE_KEYS.RAW_STOCK, {}),
  finishedStock: readLocalJson(LOCAL_STORAGE_KEYS.FINISHED_STOCK, {}),
});

const localLogin = async ({ username, password }) => {
  const normalized = String(username || '').trim().toLowerCase();
  const profile = DEMO_CREDENTIALS[normalized];

  if (!profile || profile.password !== String(password || '')) {
    throw new Error('Invalid username or password.');
  }

  const user = {
    id: normalized,
    username: normalized,
    role: profile.role,
  };

  setAuthToken(`local:${normalized}`);
  writeLocalJson(LOCAL_STORAGE_KEYS.AUTH_USER, user);
  return user;
};

const localGetCurrentUser = async () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No active session.');
  }

  const user = readLocalJson(LOCAL_STORAGE_KEYS.AUTH_USER, null);
  if (!user) {
    throw new Error('No active session.');
  }

  return user;
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

    if (response.status === 403 && url.includes('/state')) {
      legacyStateAccessBlocked = true;
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
  if (isLocalOnlyMode()) {
    return localLogin({ username, password });
  }

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
  if (isLocalOnlyMode()) {
    return localGetCurrentUser();
  }

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
  if (isLocalOnlyMode()) {
    return localLoadState();
  }

  try {
    const state = await requestJSON(buildApiUrl('/state'));
    return {
      orders: state.orders ?? [],
      dieselEntries: state.dieselEntries ?? [],
      logs: state.logs ?? [],
      rawStock: state.rawStock ?? {},
      finishedStock: state.finishedStock ?? {},
    };
  } catch (error) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      legacyStateAccessBlocked = true;
    }

    return emptyState;
  }
};

export const loadOrders = async () => {
  if (isLocalOnlyMode()) {
    return normalizeOrders(localLoadOrders());
  }

  const payload = await requestJSON(buildApiUrl('/orders'));
  return normalizeOrders(payload?.orders ?? []);
};

export const searchClientProfiles = async (query = '') => {
  const normalizedQuery = String(query || '').trim();

  if (isLocalOnlyMode()) {
    return buildClientProfilesFromOrders(localLoadOrders(), normalizedQuery);
  }

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
  if (isLocalOnlyMode()) {
    const orders = localLoadOrders();
    const now = new Date().toISOString();
    const newOrder = {
      ...orderPayload,
      id: generateLocalId(),
      status: orderPayload?.status || 'Awaiting Truck',
      createdAt: orderPayload?.createdAt || now,
      updatedAt: now,
      invoice: orderPayload?.invoice || null,
      dispatchSlip: orderPayload?.dispatchSlip || null,
    };

    localSaveOrders([newOrder, ...orders]);
    return newOrder;
  }

  const payload = await requestJSON(buildApiUrl('/orders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  });
  return normalizeOrder(payload?.order);
};

export const updateOrder = async (orderId, updates) => {
  if (isLocalOnlyMode()) {
    const orders = localLoadOrders();
    const idx = orders.findIndex((order) => String(order.id) === String(orderId));
    if (idx < 0) {
      throw new Error('Order not found.');
    }

    const next = {
      ...orders[idx],
      ...updates,
      id: orders[idx].id,
      updatedAt: new Date().toISOString(),
    };

    const nextOrders = [...orders];
    nextOrders[idx] = next;
    localSaveOrders(nextOrders);
    return next;
  }

  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return normalizeOrder(payload?.order);
};

export const updateDispatchedOrder = async (orderId, updates) => {
  if (isLocalOnlyMode()) {
    return updateOrder(orderId, updates);
  }

  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}/dispatched-edit`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return normalizeOrder(payload?.order);
};

export const transitionOrder = async (orderId, toStatus, data = {}) => {
  if (isLocalOnlyMode()) {
    return updateOrder(orderId, { status: toStatus, ...data });
  }

  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}/transition`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStatus, data }),
  });
  return normalizeOrder(payload?.order);
};

export const dispatchOrder = async (orderId, data = {}) => {
  if (isLocalOnlyMode()) {
    return updateOrder(orderId, {
      ...data,
      status: 'Dispatched',
      dispatchSlip: data?.dispatchSlip || `dispatch-slip-${orderId}.pdf`,
    });
  }

  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}/dispatch`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return normalizeOrder(payload?.order);
};

export const generateMtc = async (orderId, testData = {}) => {
  if (isLocalOnlyMode()) {
    return updateOrder(orderId, {
      mtc: `mtc-${orderId}.pdf`,
      mtcFormat: 'pdf',
    });
  }

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
  if (isLocalOnlyMode()) {
    const fileName = file?.name || `invoice-${orderId}.pdf`;
    return updateOrder(orderId, {
      status: 'Invoiced',
      invoice: fileName,
    });
  }

  const formData = new FormData();
  formData.append('file', file);

  const payload = await requestJSON(buildApiUrl(`/orders/${orderId}/documents/invoice`), {
    method: 'POST',
    body: formData,
  });

  return normalizeOrder(payload?.order);
};

export const deleteOrder = async (orderId) => {
  if (isLocalOnlyMode()) {
    const orders = localLoadOrders();
    const nextOrders = orders.filter((order) => String(order.id) !== String(orderId));
    localSaveOrders(nextOrders);
    return { ok: true, id: orderId };
  }

  return requestJSON(buildApiUrl(`/orders/${orderId}`), {
    method: 'DELETE',
  });
};

const updateRemoteState = async (key, value) => {
  if (isLocalOnlyMode()) {
    if (key === 'dieselEntries') {
      writeLocalJson(LOCAL_STORAGE_KEYS.DIESEL_ENTRIES, value);
      return { ok: true };
    }

    if (key === 'logs') {
      writeLocalJson(LOCAL_STORAGE_KEYS.LOGS, value);
      return { ok: true };
    }

    if (key === 'rawStock') {
      writeLocalJson(LOCAL_STORAGE_KEYS.RAW_STOCK, value);
      return { ok: true };
    }

    if (key === 'finishedStock') {
      writeLocalJson(LOCAL_STORAGE_KEYS.FINISHED_STOCK, value);
      return { ok: true };
    }

    return { ok: true };
  }

  if (legacyStateAccessBlocked) {
    return undefined;
  }

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
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      legacyStateAccessBlocked = true;
    }
  }
};

export const saveOrders = saveAndSync('orders');
export const saveDieselEntries = saveAndSync('dieselEntries');
export const saveLogs = saveAndSync('logs');
export const saveRawStock = saveAndSync('rawStock');
export const saveFinishedStock = saveAndSync('finishedStock');

// Production stock API endpoints (direct to backend, not legacy state)
export const updateRawStockDay = async (date, items) => {
  if (isLocalOnlyMode()) {
    return { ok: true };
  }

  return requestJSON(buildApiUrl(`/production/raw/${date}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
};

export const updateFinishedStockDay = async (date, data) => {
  if (isLocalOnlyMode()) {
    return { ok: true };
  }

  return requestJSON(buildApiUrl(`/production/finished/${date}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const getRawStockDay = async (date) => {
  if (isLocalOnlyMode()) {
    return null;
  }

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
  if (isLocalOnlyMode()) {
    return null;
  }

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
  if (isLocalOnlyMode()) {
    return { ok: true };
  }

  return requestJSON(buildApiUrl('/production/reset'), {
    method: 'DELETE',
  });
};
