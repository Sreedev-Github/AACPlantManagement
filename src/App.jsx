import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toCanvas } from 'html-to-image';
import { ConfirmModal, DispatchModal, DocPreviewModal, ImportModal, MtcModal } from './components/modals/AppModals';
import {
  AppHeader,
  DailyLogView,
  DetailedSalesReportView,
  DieselRegisterView,
  HomeView,
  LoginView,
  LoadingReportView,
  NewOrderView,
  ProductionDashboardView,
  SystemLogsView,
} from './components/views/AppViews';
import {
  FINISHED_STOCK_SIZES,
  GS_SURCHARGE,
  LOADING_STATUSES,
  RATE_CARD,
  RAW_MATERIALS_LIST,
  SIZES,
} from './constants/appConstants';
import {
  calculateColumnTotal,
  convertPiecesToCbm,
  createId,
  createTimestamp,
  formatTruckTypeShort,
  formatDateDisplay,
  formatDateTimeDisplay,
  getPreviousDateString,
  getTodayString,
  parseTruckTypeNumber,
  safeInt,
  safeNum,
} from './utils/appHelpers';
import {
  clearAuthToken,
  createOrder,
  dispatchOrder,
  deleteOrder,
  getAuthToken,
  getCurrentUser,
  loadInitialState,
  loadOrders,
  login,
  saveDieselEntries,
  saveFinishedStock,
  saveLogs,
  saveRawStock,
  searchClientProfiles,
  transitionOrder,
  uploadInvoice,
  updateDispatchedOrder,
  updateOrder,
  generateMtc,
} from './services/localStore';

// Set to 'pdf' or 'jpg' to control generated dispatch slip output format.
const DISPATCH_SLIP_OUTPUT_FORMAT = 'pdf';

export default function App() {
  const hasBootstrappedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const [role, setRole] = useState(null);
  const [orders, setOrders] = useState([]);
  const [dieselEntries, setDieselEntries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [rawStock, setRawStock] = useState({});
  const [finishedStock, setFinishedStock] = useState({});

  const [view, setView] = useState('home');
  const [productionTab, setProductionTab] = useState('raw-material');
  const [appMsg, setAppMsg] = useState(null);
  const [viewDate, setViewDate] = useState(getTodayString());
  const [filterMode, setFilterMode] = useState('date');

  const [previewFile, setPreviewFile] = useState(null);
  const [dispatchModalOrderId, setDispatchModalOrderId] = useState(null);
  const [mtcModalOrderId, setMtcModalOrderId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const [editingOrderId, setEditingOrderId] = useState(null);
  const [clientProfiles, setClientProfiles] = useState([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const clientSearchRequestRef = useRef(0);

  const [formData, setFormData] = useState({
    invoiceId: '',
    client: '',
    location: '',
    gstin: '',
    vehicle: '',
    vehicleType: '',
    transporter: '',
    size: SIZES[3],
    quantityUnit: 'CBM',
    quantityValue: '',
    cbm: '',
    bjm: '',
    rate: '',
    bjmRate: '',
    aacRateManualOverride: false,
    bjmRateManualOverride: false,
    additionalProducts: [],
  });

  const [manualDieselForm, setManualDieselForm] = useState({
    date: getTodayString(),
    name: '',
    location: '',
    purpose: '',
    driver: '',
    hsd: '',
  });

  const [dieselViewDate, setDieselViewDate] = useState(getTodayString());

  const [dieselIntakeForm, setDieselIntakeForm] = useState({
    liters: '',
  });

  const [deleteDieselConfirm, setDeleteDieselConfirm] = useState(null);

  const user = useMemo(() => ({ uid: 'local-user' }), []);

  const canUseLegacyState = (userRole) => ['management', 'production', 'loading'].includes(String(userRole || '').toLowerCase());

  const loadAppData = async (userRole = null) => {
    const initial = canUseLegacyState(userRole) ? await loadInitialState() : {
      dieselEntries: [],
      logs: [],
      rawStock: {},
      finishedStock: {},
    };
    const remoteOrders = await loadOrders();

    setOrders(remoteOrders || []);
    setDieselEntries(initial.dieselEntries || []);
    setLogs(initial.logs || []);
    setRawStock(initial.rawStock || {});
    setFinishedStock(initial.finishedStock || {});
    setHydrated(true);
  };

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    const bootstrap = async () => {
      try {
        const currentUser = await getCurrentUser();
        setRole(currentUser.role || null);
        await loadAppData(currentUser.role || null);
      } catch (err) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          clearAuthToken();
          setRole(null);
        } else {
          // It's a network or server error, let the user see it
          setAppMsg(err.message || 'Failed to connect to the server');
          setTimeout(() => setAppMsg(null), 10000);
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const handleLogin = async ({ username, password }) => {
    setAuthError('');
    setAuthLoading(true);

    try {
      const loggedInUser = await login({ username, password });
      setRole(loggedInUser.role || null);
      await loadAppData(loggedInUser.role || null);
    } catch (error) {
      setAuthError(error.message || 'Login failed');
      clearAuthToken();
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setRole(null);
    setHydrated(false);
    setOrders([]);
    setDieselEntries([]);
    setLogs([]);
    setRawStock({});
    setFinishedStock({});
    setView('home');
  };

  useEffect(() => {
    if (hydrated && canUseLegacyState(role)) saveDieselEntries(dieselEntries);
  }, [dieselEntries, hydrated, role]);

  useEffect(() => {
    if (hydrated && canUseLegacyState(role)) saveLogs(logs);
  }, [logs, hydrated, role]);

  useEffect(() => {
    if (hydrated && canUseLegacyState(role)) saveRawStock(rawStock);
  }, [rawStock, hydrated, role]);

  useEffect(() => {
    if (hydrated && canUseLegacyState(role)) saveFinishedStock(finishedStock);
  }, [finishedStock, hydrated, role]);

  const showToast = (msg) => {
    setAppMsg(msg);
    setTimeout(() => setAppMsg(null), 3000);
  };

  const patchOrderAndSync = async (orderId, updates) => {
    let updatedOrder;

    try {
      updatedOrder = await updateOrder(orderId, updates);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      const blockedDispatchedEdit = message.includes('dispatched orders cannot be edited');

      if (role === 'management' && blockedDispatchedEdit) {
        updatedOrder = await updateDispatchedOrder(orderId, updates);
      } else {
        throw error;
      }
    }

    setOrders((prev) => prev.map((order) => (order.id === orderId ? updatedOrder : order)));
    return updatedOrder;
  };

  const logAction = (action, details) => {
    if (!role) return;
    const newLog = {
      id: createId(),
      action,
      details,
      team: String(role || 'unknown').toUpperCase(),
      user: user.uid,
      timestamp: createTimestamp(),
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  const handleDateChange = (days) => {
    const parts = viewDate.split('-');
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    date.setDate(date.getDate() + days);
    setViewDate(date.toISOString().split('T')[0]);
    setFilterMode('date');
  };

  const handleDownloadReport = async () => {
    try {
      const reportType = productionTab === 'raw-material' ? 'raw' : 'finished';
      const apiBase = String(window.__AAC_CONFIG__?.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
      const pdfUrl = `${apiBase}/production/report/${viewDate}/pdf?type=${reportType}`;
      const token = getAuthToken();

      showToast('Downloading production report PDF...');

      const response = await fetch(pdfUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to download report (${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `Production_${reportType}_${viewDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      showToast('Report PDF downloaded successfully.');
    } catch (error) {
      console.error('Failed to download report:', error);
      showToast('Failed to download report. Please try again.');
    }
  };

  const requestClientProfiles = useCallback(async (query) => {
    const trimmed = String(query || '').trim();
    const requestId = clientSearchRequestRef.current + 1;
    clientSearchRequestRef.current = requestId;

    if (!trimmed) {
      setClientProfiles([]);
      setClientSearchLoading(false);
      return [];
    }

    setClientSearchLoading(true);

    try {
      const profiles = await searchClientProfiles(trimmed);
      if (requestId !== clientSearchRequestRef.current) return [];
      setClientProfiles(Array.isArray(profiles) ? profiles : []);
      return profiles;
    } catch (_error) {
      if (requestId === clientSearchRequestRef.current) {
        setClientProfiles([]);
      }
      return [];
    } finally {
      if (requestId === clientSearchRequestRef.current) {
        setClientSearchLoading(false);
      }
    }
  }, []);

  const getRawMaterialDataForDate = (date) => {
    if (rawStock[date]) return rawStock[date].items;
    const prevDate = getPreviousDateString(date);
    const prevData = rawStock[prevDate]?.items;
    return RAW_MATERIALS_LIST.map((item, index) => {
      const prevClosing = prevData ? safeNum(prevData.find((d) => d.desc === item.desc)?.closing) || 0 : 0;
      return {
        id: index,
        ...item,
        opening: prevClosing,
        receipt: 0,
        total: prevClosing,
        issue: 0,
        closing: prevClosing,
        remarks: '',
      };
    });
  };

  const getFinishedStockDataForDate = (date) => {
    let items = finishedStock[date]?.items;
    const prevDate = getPreviousDateString(date);
    const prevData = finishedStock[prevDate]?.items;
    const prevMortar = finishedStock[prevDate]?.mortarBag;
    const prevSummary = finishedStock[prevDate]?.summary || {};

    if (!items) {
      items = FINISHED_STOCK_SIZES.map((size, index) => {
        const prevClosing = prevData ? safeNum(prevData.find((d) => d.size === size)?.closing) || 0 : 0;
        return {
          id: index,
          size,
          opening: prevClosing,
          segregation: 0,
          sale: 0,
          proRejection: 0,
          loadingRejection: 0,
          selfUse: 0,
          closing: prevClosing,
        };
      });
    }

    const mortarBag = finishedStock[date]?.mortarBag || {
      opening: prevMortar ? safeNum(prevMortar.closing) : 0,
      receipt: 0,
      sale: 0,
      closing: prevMortar ? safeNum(prevMortar.closing) : 0,
    };

    const summary = finishedStock[date]?.summary || {
      saleDaily: 0,
      productionDaily: 0,
      totalSale: prevSummary.totalSale ? safeNum(prevSummary.totalSale) : 0,
      totalProduction: prevSummary.totalProduction ? safeNum(prevSummary.totalProduction) : 0,
      totalMortarSale: 0,
    };

    return { items, mortarBag, summary };
  };

  const updateRawStock = (index, field, value) => {
    if (field !== 'remarks' && Number.isNaN(Number(value))) {
      showToast('Please enter a valid number');
      return;
    }

    const currentData = getRawMaterialDataForDate(viewDate);
    const newData = [...currentData];
    newData[index] = { ...newData[index], [field]: field === 'remarks' ? value : safeNum(value) };

    const op = safeNum(newData[index].opening);
    const rec = safeNum(newData[index].receipt);
    const iss = safeNum(newData[index].issue);
    newData[index].total = op + rec;
    newData[index].closing = newData[index].total - iss;

    setRawStock((prev) => ({
      ...prev,
      [viewDate]: {
        items: newData,
        timestamp: createTimestamp(),
      },
    }));

    logAction('STOCK UPDATE', `Updated ${newData[index].desc} stock for ${viewDate}`);
  };

  const updateFinishedStock = (index, field, value) => {
    if (Number.isNaN(Number(value))) {
      showToast('Please enter a valid number');
      return;
    }

    const { items, mortarBag, summary } = getFinishedStockDataForDate(viewDate);
    const newData = [...items];
    newData[index] = { ...newData[index], [field]: safeNum(value) };

    const op = safeNum(newData[index].opening);
    const seg = safeNum(newData[index].segregation);
    const sale = safeNum(newData[index].sale);
    const pr = safeNum(newData[index].proRejection);
    const lr = safeNum(newData[index].loadingRejection);
    const su = safeNum(newData[index].selfUse);

    newData[index].closing = (op + seg) - (sale + pr + lr + su);
    const newSaleDaily = newData.reduce((acc, item) => acc + safeNum(item.sale), 0);
    const newSummary = { ...summary, saleDaily: newSaleDaily };

    setFinishedStock((prev) => ({
      ...prev,
      [viewDate]: {
        items: newData,
        mortarBag,
        summary: newSummary,
        timestamp: createTimestamp(),
      },
    }));

    logAction('STOCK UPDATE', `Updated ${newData[index].size} finished stock for ${viewDate}`);
  };

  const updateMortarBag = (field, value) => {
    if (Number.isNaN(Number(value))) {
      showToast('Please enter a valid number');
      return;
    }

    const { items, mortarBag, summary } = getFinishedStockDataForDate(viewDate);
    const newMortar = { ...mortarBag, [field]: safeNum(value) };
    const op = safeNum(newMortar.opening);
    const rec = safeNum(newMortar.receipt);
    const sale = safeNum(newMortar.sale);
    newMortar.closing = op + rec - sale;

    setFinishedStock((prev) => ({
      ...prev,
      [viewDate]: {
        items,
        mortarBag: newMortar,
        summary,
        timestamp: createTimestamp(),
      },
    }));
  };

  const updateProductionSummary = (field, value) => {
    if (Number.isNaN(Number(value))) {
      showToast('Please enter a valid number');
      return;
    }

    const { items, mortarBag, summary } = getFinishedStockDataForDate(viewDate);
    const newSummary = { ...summary, [field]: safeNum(value) };

    setFinishedStock((prev) => ({
      ...prev,
      [viewDate]: {
        items,
        mortarBag,
        summary: newSummary,
        timestamp: createTimestamp(),
      },
    }));
  };

  const handleEditOrder = (order) => {
    setEditingOrderId(order.id);
    setFormData({
      invoiceId: order.invoiceId || order.invoiceNumber || '',
      client: order.client,
      location: order.location,
      gstin: order.gstin || '',
      vehicle: order.vehicle,
      vehicleType: formatTruckTypeShort(order.vehicleType || order.truckType),
      transporter: order.transporter || '',
      size: order.size,
      quantityUnit: order.quantityUnit || 'CBM',
      quantityValue: order.quantityValue ?? order.cbm ?? '',
      cbm: order.cbm ?? '',
      bjm: order.bjm ?? '',
      rate: order.rate ?? '',
      bjmRate: order.bjmRate || '',
      aacRateManualOverride: Boolean(order.aacRateManualOverride),
      bjmRateManualOverride: Boolean(order.bjmRateManualOverride),
      additionalProducts: Array.isArray(order.additionalProducts) ? order.additionalProducts : [],
    });
    setView('new-order');
  };

  const triggerDelete = (orderId) => {
    setDeleteConfirmId(orderId);
  };

  const confirmDeleteOrder = async () => {
    if (!deleteConfirmId) return;

    setLoadingMsg('Deleting order...');
    try {
      await deleteOrder(deleteConfirmId);
      setOrders((prev) => prev.filter((order) => order.id !== deleteConfirmId));
      logAction('DELETE ORDER', `Deleted Order ID: ${deleteConfirmId}`);
      showToast('Order deleted');
      setDeleteConfirmId(null);
    } catch (error) {
      showToast(error.message || 'Failed to delete order');
    } finally {
      setLoadingMsg(null);
    }
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (!String(formData.vehicle || '').trim() || !String(formData.vehicleType || '').trim() || !String(formData.transporter || '').trim()) {
      showToast('Vehicle Number, Vehicle Type and Transporter are required.');
      return;
    }

    const parseNumber = (value, fieldName, isInteger = false) => {
      const strVal = String(value ?? '').trim();
      if (strVal === '') return 0;
      const parsed = Number(strVal);
      if (!Number.isFinite(parsed)) {
        throw new Error(`${fieldName} must be a valid number.`);
      }
      if (isInteger && !Number.isInteger(parsed)) {
        throw new Error(`${fieldName} must be an integer.`);
      }
      return parsed;
    };

    let primaryQuantityValue, primaryCbm, bjm, rate, bjmRate, additionalProducts;
    const primaryQuantityUnit = formData.quantityUnit || 'CBM';
    const primaryQuantityRaw = String(formData.quantityValue ?? formData.cbm ?? '').trim();

    try {
      primaryQuantityValue = parseNumber(primaryQuantityRaw, 'Quantity');
      bjm = parseNumber(formData.bjm, 'BJM (Bags)', true);
      rate = parseNumber(formData.rate, 'Rate (AAC Block)');
      bjmRate = parseNumber(formData.bjmRate, 'Rate (BJM)');
      
      primaryCbm = primaryQuantityUnit === 'PCS'
        ? convertPiecesToCbm(primaryQuantityValue, formData.size)
        : primaryQuantityValue;

      additionalProducts = (formData.additionalProducts || [])
        .map((item, index) => {
          const strQty = String(item.quantity ?? '').trim();
          if (strQty === '') return null;
          const quantity = parseNumber(strQty, `Additional Product ${index + 1} Quantity`);
          if (!quantity) return null;
          const unit = item.quantityUnit || 'CBM';
          const size = item.size || SIZES[3];
          const cbm = unit === 'PCS' ? convertPiecesToCbm(quantity, size) : quantity;
          return {
            size,
            quantity,
            quantityUnit: unit,
            cbm: Number(cbm.toFixed(3)),
            rate: parseNumber(item.rate, `Additional Product ${index + 1} Rate`),
          };
        })
        .filter(Boolean);
    } catch (err) {
      showToast(err.message);
      return;
    }

    const normalizedFormData = {
      ...formData,
      invoiceId: String(formData.invoiceId || '').trim(),
      client: String(formData.client || '').trim(),
      location: String(formData.location || '').trim(),
      gstin: String(formData.gstin || '').trim(),
      vehicle: String(formData.vehicle || '').trim(),
      vehicleType: formatTruckTypeShort(formData.vehicleType),
      truckType: parseTruckTypeNumber(formData.vehicleType) || 0,
      transporter: String(formData.transporter || '').trim(),
      size: formData.size || SIZES[3],
      quantityUnit: primaryQuantityUnit,
      quantityValue: primaryQuantityValue,
      cbm: Number(primaryCbm.toFixed(3)),
      bjm: bjm,
      rate: rate,
      bjmRate: bjmRate,
      aacRateManualOverride: Boolean(formData.aacRateManualOverride),
      bjmRateManualOverride: Boolean(formData.bjmRateManualOverride),
      additionalProducts,
    };

    setLoadingMsg(editingOrderId ? 'Updating order...' : 'Creating order...');
    try {
      if (editingOrderId) {
        await patchOrderAndSync(editingOrderId, normalizedFormData);
        logAction('UPDATE ORDER', `Updated order for ${formData.client}`);
        showToast('Order Updated');
        setEditingOrderId(null);
      } else {
        const createdOrder = await createOrder({
          ...normalizedFormData,
          orderDate: viewDate,
        });

        setOrders((prev) => [createdOrder, ...prev]);
        logAction('CREATE ORDER', `Created order for ${formData.client}`);
        showToast('Order Created');
      }
    } catch (error) {
      showToast(error.message || 'Failed to save order');
      return;
    } finally {
      setLoadingMsg(null);
    }

    setView('daily-log');
    setFilterMode('date');
    setFormData({
      invoiceId: '',
      client: '',
      location: '',
      gstin: '',
      vehicle: '',
      vehicleType: '',
      transporter: '',
      size: SIZES[3],
      quantityUnit: 'CBM',
      quantityValue: '',
      cbm: '',
      bjm: '',
      rate: '',
      bjmRate: '',
      aacRateManualOverride: false,
      bjmRateManualOverride: false,
      additionalProducts: [],
    });
  };

  const handleManualDieselSubmit = (e) => {
    e.preventDefault();

    if (!String(manualDieselForm.name || '').trim()) {
      showToast('Vehicle Number is required.');
      return;
    }

    if (!String(manualDieselForm.location || '').trim()) {
      showToast('Site / Location is required.');
      return;
    }

    if (!String(manualDieselForm.purpose || '').trim()) {
      showToast('Purpose is required for in-plant diesel entries.');
      return;
    }

    if (!String(manualDieselForm.driver || '').trim()) {
      showToast('Operator / Issued To is required.');
      return;
    }

    const selectedDate = String(dieselViewDate || getTodayString()).trim() || getTodayString();
    const liters = Number(manualDieselForm.hsd);

    if (!Number.isFinite(liters)) {
      showToast('HSD must be a valid number.');
      return;
    }

    const kmStr = String(manualDieselForm.km || '').trim();
    if (kmStr !== '' && !Number.isFinite(Number(kmStr))) {
      showToast('KM / Hrs must be a valid number.');
      return;
    }

    const newEntry = {
      id: createId(),
      date: selectedDate,
      ...manualDieselForm,
      hsd: liters,
      km: kmStr !== '' ? Number(kmStr) : undefined,
      purpose: String(manualDieselForm.purpose || '').trim(),
      flowType: 'Usage',
      createdAt: createTimestamp(),
    };

    setDieselEntries((prev) => [newEntry, ...prev]);
    logAction('DIESEL ENTRY', `Added entry for ${manualDieselForm.name}`);
    showToast('In-Plant Entry Added');
    setManualDieselForm({ date: selectedDate, name: '', location: '', purpose: '', driver: '', hsd: '', km: '' });
  };

  const handleDieselIntakeSubmit = (e) => {
    e.preventDefault();

    const liters = Number(dieselIntakeForm.liters);
    if (!Number.isFinite(liters) || liters <= 0) {
      showToast('Please enter a valid diesel intake amount.');
      return;
    }

    const selectedDate = String(dieselViewDate || getTodayString()).trim() || getTodayString();

    const newEntry = {
      id: createId(),
      date: selectedDate,
      name: 'Diesel Intake',
      location: 'Tank',
      driver: 'Store',
      purpose: 'Fuel Intake',
      hsd: liters,
      liters,
      flowType: 'Inflow',
      createdAt: createTimestamp(),
    };

    setDieselEntries((prev) => [newEntry, ...prev]);
    logAction('DIESEL INTAKE', `Added diesel intake of ${liters}`);
    showToast('Diesel intake added');
    setDieselIntakeForm({ liters: '' });
  };

  const handleBulkImport = async (data) => {
    setLoadingMsg('Importing orders...');
    try {
      const records = await Promise.all(
        data.map((item) => createOrder({
          ...item,
          orderDate: item.orderDate || viewDate,
        })),
      );

      setOrders((prev) => [...records, ...prev]);
      logAction('BULK IMPORT', `Imported ${records.length} records from CSV`);
      showToast(`Successfully imported ${records.length} records`);
      setShowImportModal(false);
    } catch (error) {
      showToast(error.message || 'Failed to import orders');
    } finally {
      setLoadingMsg(null);
    }
  };

  const updateStatus = async (orderId, newStatus, extraData = {}) => {
    setLoadingMsg('Updating order status...');
    try {
      const updatedOrder = await transitionOrder(orderId, newStatus, extraData);
      setOrders((prev) => prev.map((order) => (order.id === orderId ? updatedOrder : order)));
      logAction('STATUS CHANGE', `Updated Order ${orderId} to ${newStatus}`);
      showToast('Status updated');
    } catch (error) {
      showToast(error.message || 'Failed to update status');
    } finally {
      setLoadingMsg(null);
    }
  };

  const updateEntry = async (collectionName, id, field, value) => {
    const resolvedField = collectionName === 'orders'
      ? ({ date: 'orderDate', name: 'client', driver: 'driverName', km: 'tripKm' }[field] || field)
      : field;
    let finalValue = value;

    if (['date', 'orderDate'].includes(field) && !String(value || '').trim()) {
      showToast('Date is required.');
      return;
    }

    if (['cbm', 'bjm', 'rate', 'bjmRate', 'truckType', 'netWt', 'loadingRate', 'unloadingRate', 'tripKm', 'grossWeight', 'tareWeight', 'piecesLoaded', 'hsd', 'km'].includes(field)) {
      finalValue = Number(value);
      if (Number.isNaN(finalValue)) {
        showToast(`${field} must be a valid number.`);
        return;
      }
    } else if (field === 'hsd') {
      finalValue = String(value);
    }

    if (collectionName === 'orders') {
      try {
        await patchOrderAndSync(id, { [resolvedField]: finalValue });
      } catch (error) {
        showToast(error.message || `Failed to update ${field}`);
        return;
      }
    }

    if (collectionName === 'diesel_entries') {
      const dieselField = field === 'id' ? 'vehicle' : field;
      if (dieselField === 'date' && !String(finalValue || '').trim()) {
        showToast('Date is required.');
        return;
      }
      setDieselEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, [dieselField]: finalValue } : entry)));
    }

    logAction('INLINE EDIT', `Updated ${field} to ${finalValue} in ${collectionName}`);
    showToast(`${field} updated!`);
  };

  const triggerDeleteDieselEntry = (entry) => {
    setDeleteDieselConfirm(entry);
  };

  const confirmDeleteDieselEntry = async () => {
    if (!deleteDieselConfirm) return;

    const { collection, sourceId } = deleteDieselConfirm;

    setLoadingMsg('Deleting diesel entry...');
    try {
      if (collection === 'orders') {
        await patchOrderAndSync(sourceId, { hsd: '', tripKm: '' });
        setOrders((prev) => prev.map((order) => (order.id === sourceId ? { ...order, hsd: '', tripKm: '' } : order)));
      } else {
        setDieselEntries((prev) => prev.filter((entry) => entry.id !== sourceId));
      }

      logAction('DELETE DIESEL ENTRY', `Deleted diesel register row ${sourceId}`);
      showToast('Diesel entry deleted');
      setDeleteDieselConfirm(null);
    } catch (error) {
      showToast(error.message || 'Failed to delete diesel entry');
    } finally {
      setLoadingMsg(null);
    }
  };

  const updateTruckTypeAndRates = async (order, newTypeVal) => {
    const normalizedTruckType = formatTruckTypeShort(newTypeVal);
    const tType = parseTruckTypeNumber(normalizedTruckType);
    let updates = { truckType: normalizedTruckType };
    let newLoadRate = 0;
    let newUnloadRate = 0;

    if (tType && tType > 0) {
      const baseLoad = RATE_CARD.loading[tType] || 0;
      newLoadRate = baseLoad;
      if (order.gsChecked) {
        newLoadRate += GS_SURCHARGE;
      }
      if (order.transporter && order.transporter.toUpperCase() === 'ABC') {
        newUnloadRate = RATE_CARD.unloading[tType] || 0;
      } else {
        newUnloadRate = 0;
      }
    }

    updates = { ...updates, loadingRate: newLoadRate, unloadingRate: newUnloadRate };

    setLoadingMsg('Updating truck type & rates...');
    try {
      await patchOrderAndSync(order.id, updates);
      logAction('RATE UPDATE', `Updated Truck Type/Rates for Order ${order.id}`);
      showToast('Type & Rates updated');
    } catch (error) {
      showToast(error.message || 'Failed to update truck type and rates');
    } finally {
      setLoadingMsg(null);
    }
  };

  const toggleGS = async (order) => {
    const newGSState = !order.gsChecked;
    const currentLoadRate = Number(order.loadingRate) || 0;
    let newRate = currentLoadRate;
    const tType = parseInt(String(order.truckType).replace(/\D/g, ''), 10);

    if (!Number.isNaN(tType) && tType > 0) {
      const baseRate = RATE_CARD.loading[tType] || 0;
      newRate = newGSState ? baseRate + GS_SURCHARGE : baseRate;
    } else {
      newRate = newGSState ? currentLoadRate + GS_SURCHARGE : currentLoadRate - GS_SURCHARGE;
      if (newRate < 0) newRate = 0;
    }

    setLoadingMsg('Toggling GS surcharge...');
    try {
      await patchOrderAndSync(order.id, { gsChecked: newGSState, loadingRate: newRate });
      logAction('GS TOGGLE', `Toggled GS for Order ${order.id}`);
      showToast(newGSState ? 'GS Added (+500)' : 'GS Removed');
    } catch (error) {
      showToast(error.message || 'Failed to update GS');
    } finally {
      setLoadingMsg(null);
    }
  };

  const handleFileUpload = async (orderId, type, nextStatus, file = null) => {
    setLoadingMsg(type === 'invoice' ? 'Uploading invoice PDF...' : `Uploading ${type}...`);
    try {
      if (type === 'invoice') {
        if (!file) {
          showToast('Please select a PDF invoice file.');
          return;
        }

        const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf');
        if (!isPdf) {
          showToast('Only PDF invoices are allowed.');
          return;
        }

        const updatedOrder = await uploadInvoice(orderId, file);
        setOrders((prev) => prev.map((order) => (order.id === orderId ? updatedOrder : order)));
        logAction('FILE UPLOAD', `Uploaded invoice for Order ${orderId}`);
        showToast('Invoice uploaded');
        return;
      }

      const fileName = type === 'dispatchSlip' ? `Slip_${Math.floor(Math.random() * 1000)}.jpg` : `Invoice_${Math.floor(Math.random() * 1000)}.pdf`;
      await updateStatus(orderId, nextStatus, { [type]: fileName });
      logAction('FILE UPLOAD', `Uploaded ${type} for Order ${orderId}`);
    } catch (error) {
      showToast(error.message || 'Failed to upload file');
    } finally {
      setLoadingMsg(null);
    }
  };

  const openPreview = (fileType, fileName, orderId = null, canApprove = false, fileUrl = null) => {
    const orderData = orders.find((o) => o.id === orderId);
    const resolvedFileUrl = fileUrl
      || (fileType === 'invoice' ? orderData?.invoiceUrl : orderData?.dispatchSlipUrl)
      || null;

    if (resolvedFileUrl && !canApprove) {
      window.open(resolvedFileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setPreviewFile({ fileType, fileName, orderId, canApprove, orderData, fileUrl: resolvedFileUrl });
  };

  const handleApproveFromPreview = async () => {
    if (previewFile && previewFile.orderId) {
      setLoadingMsg('Approving invoice...');
      try {
        await updateStatus(previewFile.orderId, 'Approved');
        setPreviewFile(null);
      } catch (error) {
        showToast(error.message || 'Failed to approve invoice');
      } finally {
        setLoadingMsg(null);
      }
    }
  };

  const handleDispatchSubmit = async (orderId, data) => {
    const latestOrder = orders.find((order) => order.id === orderId);
    if (latestOrder && latestOrder.status !== 'Approved') {
      showToast(`Cannot dispatch. Current status is ${latestOrder.status}. Refresh and try again.`);
      return;
    }

    setLoadingMsg('Dispatching order & generating slip...');
    try {
      const updatedOrder = await dispatchOrder(orderId, {
        ...data,
        invoiceId: String(data.invoiceId || '').trim(),
        purpose: 'Sales',
        slipFormat: DISPATCH_SLIP_OUTPUT_FORMAT,
      });

      setOrders((prev) => prev.map((order) => (order.id === orderId ? updatedOrder : order)));
      logAction('DISPATCH', `Dispatched Order ${orderId} with slip ${updatedOrder?.dispatchSlip || 'generated'}`);
      showToast(`Dispatched with ${DISPATCH_SLIP_OUTPUT_FORMAT.toUpperCase()} slip`);
      setDispatchModalOrderId(null);
    } catch (error) {
      console.error('Dispatch failed:', error);
      showToast(error.message || 'Failed to dispatch order');
    } finally {
      setLoadingMsg(null);
    }
  };

  const getStats = () => {
    const todayStr = getTodayString();
    const active = orders.filter((o) => ['Loading', 'Truck at Site', 'Loading Complete'].includes(o.status)).length;
    const pendingInv = orders.filter((o) => o.status === 'Loading Complete').length;
    const pendingApprove = orders.filter((o) => o.status === 'Invoiced').length;
    const todayOrders = orders.filter((o) => o.orderDate === todayStr).length;
    const backlog = orders.filter((o) => o.orderDate < todayStr && o.status !== 'Dispatched').length;
    return { active, pendingInv, pendingApprove, todayOrders, backlog };
  };

  const stats = getStats();

  const getDieselRegisterData = (selectedDate = dieselViewDate) => {
    const targetDate = String(selectedDate || getTodayString()).trim() || getTodayString();

    const toDieselAmount = (entry = {}) => {
      const rawValue = entry.hsd ?? entry.liters ?? 0;
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const resolveDate = (entry = {}) => {
      const directDate = String(entry.date || entry.orderDate || '').trim();
      return /^\d{4}-\d{2}-\d{2}/.test(directDate) ? directDate.slice(0, 10) : '';
    };

    const resolveCreatedAt = (entry = {}) => String(entry.createdAt || entry.updatedAt || resolveDate(entry) || '').trim();

    const normalizeLedgerRow = (entry, collection, sourceId, flowType) => ({
      sourceId,
      collection,
      flowType,
      date: resolveDate(entry),
      createdAt: resolveCreatedAt(entry),
      vehicle: String(entry.vehicle || '').trim(),
      name: String(entry.name || entry.client || '').trim(),
      location: String(entry.location || '').trim(),
      driver: String(entry.driver || entry.driverName || '').trim(),
      purpose: String(entry.purpose || '').trim(),
      km: String(entry.km ?? entry.tripKm ?? '').trim(),
      hsd: toDieselAmount(entry),
    });

    const salesData = orders
      .filter((order) => String(order.hsd ?? '').trim() !== '')
      .map((order) => normalizeLedgerRow(
        {
          ...order,
          name: order.client,
          purpose: order.purpose || 'Sales',
          km: order.tripKm ?? '',
        },
        'orders',
        order.id,
        'Usage',
      ));

    const manualData = dieselEntries.map((entry) => normalizeLedgerRow(
      entry,
      'diesel_entries',
      entry.id,
      String(entry.flowType || '').toLowerCase() === 'inflow' ? 'Inflow' : 'Usage',
    ));

    const allEntries = [...salesData, ...manualData]
      .filter((entry) => entry.date)
      .sort((left, right) => (left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt)));

    const balanceBeforeDay = allEntries
      .filter((entry) => entry.date < targetDate)
      .reduce((current, entry) => (String(entry.flowType).toLowerCase() === 'inflow' ? current + entry.hsd : current - entry.hsd), 0);

    let balance = balanceBeforeDay;
    const rows = [
      {
        id: `opening-${targetDate}`,
        isPlaceholder: true,
        date: targetDate,
        opening: balanceBeforeDay,
        closing: balanceBeforeDay,
      },
    ];

    allEntries
      .filter((entry) => entry.date === targetDate)
      .forEach((entry) => {
        const opening = balance;
        const amount = Number(entry.hsd) || 0;
        const closing = String(entry.flowType).toLowerCase() === 'inflow' ? opening + amount : opening - amount;
        balance = closing;

        rows.push({
          ...entry,
          id: `${entry.collection}-${entry.sourceId}-${entry.date}-${entry.createdAt || 'row'}`,
          opening,
          closing,
        });
      });

    return rows;
  };

  const parseDateString = (dateStr) => {
    if (!dateStr) return 0;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      } else if (parts[2].length === 4) {
        return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
    }
    return new Date(dateStr).getTime() || 0;
  };

  const getLoadingReportData = () =>
    orders
      .filter((o) => o.status === 'Dispatched')
      .sort((a, b) => parseDateString(b.orderDate) - parseDateString(a.orderDate))
      .map((o) => {
        let displayLoadRate = o.loadingRate;
        let displayUnloadRate = o.unloadingRate;
        const tType = parseInt(String(o.truckType).replace(/\D/g, ''), 10);

        if (displayLoadRate === undefined || displayLoadRate === '') {
          const base = RATE_CARD.loading[tType] || 0;
          displayLoadRate = o.gsChecked ? base + GS_SURCHARGE : base;
        }

        if (displayUnloadRate === undefined || displayUnloadRate === '') {
          if (o.transporter && o.transporter.toUpperCase() === 'ABC' && tType > 0) {
            displayUnloadRate = RATE_CARD.unloading[tType] || 0;
          } else {
            displayUnloadRate = 0;
          }
        }

        return { ...o, displayLoadRate, displayUnloadRate };
      });

  const getDetailedSalesData = () =>
    orders
      .filter((o) => o.status === 'Dispatched')
      .sort((a, b) => parseDateString(b.orderDate) - parseDateString(a.orderDate))
      .map((o) => {
        const cbm = parseFloat(o.cbm) || 0;
        const rate = parseFloat(o.rate) || 0;
        const totalBill = (cbm * rate).toFixed(2);

        let displayLoadRate = o.loadingRate;
        let displayUnloadRate = o.unloadingRate;
        const tType = parseInt(String(o.truckType).replace(/\D/g, ''), 10);

        if (displayLoadRate === undefined || displayLoadRate === '') {
          const base = RATE_CARD.loading[tType] || 0;
          displayLoadRate = o.gsChecked ? base + GS_SURCHARGE : base;
        }

        if (displayUnloadRate === undefined || displayUnloadRate === '') {
          if (o.transporter && o.transporter.toUpperCase() === 'ABC' && tType > 0) {
            displayUnloadRate = RATE_CARD.unloading[tType] || 0;
          } else {
            displayUnloadRate = 0;
          }
        }

        return { ...o, totalBill, displayLoadRate, displayUnloadRate };
      });

  let displayedOrders = [];
  if (filterMode === 'date') {
    displayedOrders = orders.filter((o) => o.orderDate === viewDate);
  } else if (filterMode === 'active') {
    displayedOrders = orders.filter((o) => ['Loading', 'Truck at Site', 'Loading Complete'].includes(o.status));
  } else if (filterMode === 'approval') {
    displayedOrders = orders.filter((o) => o.status === 'Invoiced');
  } else if (filterMode === 'backlog') {
    const todayStr = getTodayString();
    displayedOrders = orders.filter((o) => o.orderDate < todayStr && o.status !== 'Dispatched');
  } else if (filterMode === 'pending_invoice') {
    displayedOrders = orders.filter((o) => o.status === 'Loading Complete');
  }

  const setViewAndFilter = (viewName, mode, date = null) => {
    setView(viewName);
    setFilterMode(mode);
    if (date) setViewDate(date);
  };

  const dispatchOrderObj = orders.find((o) => o.id === dispatchModalOrderId);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">Loading App...</div>;
  }

  if (!role) {
    return <LoginView onLogin={handleLogin} loading={authLoading} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 relative">
      {appMsg && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-bounce">{appMsg}</div>}
      {loadingMsg && (
        <div id="app-loading-overlay" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-white/95 p-8 rounded-2xl shadow-2xl border border-slate-200/50 flex flex-col items-center max-w-sm mx-4 transform scale-100 transition-all duration-300">
            <div className="relative w-16 h-16 mb-4">
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin"></div>
              <div className="absolute inset-2 w-12 h-12 rounded-full border-4 border-transparent border-b-indigo-500 animate-spin [animation-direction:reverse]"></div>
            </div>
            <p className="text-slate-800 font-bold text-lg mb-1">Please Wait</p>
            <p className="text-slate-500 text-sm text-center font-medium animate-pulse">{loadingMsg}</p>
          </div>
        </div>
      )}
      {previewFile && (<DocPreviewModal fileType={previewFile.fileType} fileName={previewFile.fileName} fileUrl={previewFile.fileUrl} canApprove={previewFile.canApprove} onClose={() => setPreviewFile(null)} onApprove={handleApproveFromPreview} orderData={previewFile.orderData} />)}
      {deleteConfirmId && (<ConfirmModal title="Delete Order?" message="This action cannot be undone. Are you sure?" onConfirm={confirmDeleteOrder} onCancel={() => setDeleteConfirmId(null)} />)}
      {deleteDieselConfirm && (<ConfirmModal title="Delete Diesel Entry?" message="This action cannot be undone. Are you sure?" onConfirm={confirmDeleteDieselEntry} onCancel={() => setDeleteDieselConfirm(null)} />)}
      {showImportModal && (<ImportModal onClose={() => setShowImportModal(false)} onImport={handleBulkImport} />)}
      {dispatchOrderObj && (<DispatchModal order={dispatchOrderObj} onClose={() => setDispatchModalOrderId(null)} onSubmit={handleDispatchSubmit} logs={logs} />)}
      {mtcModalOrderId && (
        <MtcModal
          orderId={mtcModalOrderId}
          onClose={() => setMtcModalOrderId(null)}
          onGenerate={async (orderId, testData) => {
            setLoadingMsg('Generating Material Testing Certificate...');
            try {
              const updated = await generateMtc(orderId, testData);
              setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
              logAction('MTC GENERATED', `Generated MTC for Order ${orderId}`);
              showToast('MTC generated and uploaded');
            } catch (err) {
              console.error('Generate MTC failed', err);
              showToast(err?.message || 'Failed to generate MTC');
              throw err;
            } finally {
              setLoadingMsg(null);
            }
          }}
        />
      )}

      <AppHeader
        role={role}
        setViewAndFilter={setViewAndFilter}
        view={view}
        filterMode={filterMode}
        viewDate={viewDate}
        getTodayString={getTodayString}
        setEditingOrderId={setEditingOrderId}
        setFormData={setFormData}
        setView={setView}
        onLogout={handleLogout}
        SIZES={SIZES}
      />

      <main className="max-w-5xl mx-auto px-4 py-6">
        {view === 'home' && (
          <HomeView
            role={role}
            stats={stats}
            setViewAndFilter={setViewAndFilter}
            getTodayString={getTodayString}
            setView={setView}
            setProductionTab={setProductionTab}
            setViewDate={setViewDate}
            setEditingOrderId={setEditingOrderId}
            setFormData={setFormData}
            setFilterMode={setFilterMode}
            SIZES={SIZES}
          />
        )}

        {view === 'production-dashboard' && (
          <ProductionDashboardView
            handleDateChange={handleDateChange}
            handleDownloadReport={handleDownloadReport}
            productionTab={productionTab}
            setProductionTab={setProductionTab}
            viewDate={viewDate}
            formatDateDisplay={formatDateDisplay}
            getRawMaterialDataForDate={getRawMaterialDataForDate}
            updateRawStock={updateRawStock}
            calculateColumnTotal={calculateColumnTotal}
            getFinishedStockDataForDate={getFinishedStockDataForDate}
            updateFinishedStock={updateFinishedStock}
            updateMortarBag={updateMortarBag}
            updateProductionSummary={updateProductionSummary}
            FINISHED_STOCK_SIZES={FINISHED_STOCK_SIZES}
            readOnly={['sales', 'accounts'].includes(role)}
          />
        )}

        {view === 'system-logs' && <SystemLogsView logs={logs} formatDateTimeDisplay={formatDateTimeDisplay} />}

        {view === 'loading-report' && (
          <LoadingReportView
            getLoadingReportData={getLoadingReportData}
            updateEntry={updateEntry}
            updateTruckTypeAndRates={updateTruckTypeAndRates}
            toggleGS={toggleGS}
            safeInt={safeInt}
          />
        )}

        {view === 'detailed-sales-report' && (
          <DetailedSalesReportView
            getDetailedSalesData={getDetailedSalesData}
            updateEntry={updateEntry}
            openPreview={openPreview}
            updateTruckTypeAndRates={updateTruckTypeAndRates}
            toggleGS={toggleGS}
            safeInt={safeInt}
          />
        )}

        {view === 'diesel-register' && (
          <DieselRegisterView
            getDieselRegisterData={getDieselRegisterData}
            updateEntry={updateEntry}
            handleManualDieselSubmit={handleManualDieselSubmit}
            manualDieselForm={manualDieselForm}
            setManualDieselForm={setManualDieselForm}
            handleDieselIntakeSubmit={handleDieselIntakeSubmit}
            dieselIntakeForm={dieselIntakeForm}
            setDieselIntakeForm={setDieselIntakeForm}
            dieselViewDate={dieselViewDate}
            setDieselViewDate={setDieselViewDate}
            getTodayString={getTodayString}
            setView={setView}
            onDeleteEntry={triggerDeleteDieselEntry}
          />
        )}

        {view === 'new-order' && (
          <NewOrderView
            setView={setView}
            editingOrderId={editingOrderId}
            viewDate={viewDate}
            formatDateDisplay={formatDateDisplay}
            handleSubmitOrder={handleSubmitOrder}
            formData={formData}
            setFormData={setFormData}
            clientProfiles={clientProfiles}
            clientSearchLoading={clientSearchLoading}
            requestClientProfiles={requestClientProfiles}
            SIZES={SIZES}
          />
        )}

        {view === 'daily-log' && (
          <DailyLogView
            filterMode={filterMode}
            handleDateChange={handleDateChange}
            setViewAndFilter={setViewAndFilter}
            viewDate={viewDate}
            formatDateDisplay={formatDateDisplay}
            getTodayString={getTodayString}
            displayedOrders={displayedOrders}
            role={role}
            handleEditOrder={handleEditOrder}
            triggerDelete={triggerDelete}
            openPreview={openPreview}
            LOADING_STATUSES={LOADING_STATUSES}
            updateStatus={updateStatus}
            setDispatchModalOrderId={setDispatchModalOrderId}
            setMtcModalOrderId={setMtcModalOrderId}
            handleFileUpload={handleFileUpload}
          />
        )}
      </main>
    </div>
  );
}


