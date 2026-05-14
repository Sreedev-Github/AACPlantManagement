import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng, toCanvas } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';
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
  saveLogs,
  searchClientProfiles,
  transitionOrder,
  uploadInvoice,
  updateDispatchedOrder,
  updateOrder,
  generateMtc,
  updateRawStockDay,
  updateFinishedStockDay,
  resetProductionStock,
} from './services/localStore';

// Set to 'pdf' or 'jpg' to control generated dispatch slip output format.
const DISPATCH_SLIP_OUTPUT_FORMAT = 'pdf';

export default function App() {
  const hasBootstrappedRef = useRef(false);
  const [loading, setLoading] = useState(true);
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

  const user = useMemo(() => ({ uid: 'local-user' }), []);

  const TEMP_LOGINS = useMemo(() => ([
    { role: 'Sales', username: 'sales1', password: 'sales123' },
    { role: 'Loading', username: 'loading1', password: 'load1234' },
    { role: 'Accounts', username: 'accounts1', password: 'acc12345' },
    { role: 'Management', username: 'manager1', password: 'manage123' },
    { role: 'Production', username: 'prod1', password: 'prod1234' },
  ]), []);

  const canUseLegacyState = (userRole) => ['management', 'production'].includes(String(userRole || '').toLowerCase());

  const loadAppData = async (userRole = null) => {
    const initial = canUseLegacyState(userRole) ? await loadInitialState() : {
      dieselEntries: [],
      logs: [],
      rawStock: {},
      finishedStock: {},
    };
    let remoteOrders = [];

    try {
      remoteOrders = await loadOrders();
    } catch (_err) {
      remoteOrders = [];
    }

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
      } catch (_err) {
        clearAuthToken();
        setRole(null);
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

  const showToast = (msg) => {
    setAppMsg(msg);
    setTimeout(() => setAppMsg(null), 3000);
  };

  const handleResetProductionStock = async () => {
    if (!window.confirm('Clear all production stock data from the app and database?')) {
      return;
    }

    try {
      await resetProductionStock();
      setRawStock({});
      setFinishedStock({});
      showToast('Production stock data cleared.');
    } catch (error) {
      console.error('Failed to reset production stock:', error);
      showToast('Failed to clear production stock data.');
    }
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
      showToast('Preparing PDF...');

      const container = document.getElementById('report-container');
      if (!container) throw new Error('Report container not found');

      // Create a high-resolution PNG of the report container
      const dataUrl = await toPng(container, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const imgBytes = await res.arrayBuffer();

      // Create a PDF with the image scaled to A4 width (points)
      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(imgBytes);

      const A4_WIDTH = 595.28; // points
      const pngDims = pngImage.scale(1);
      const scale = A4_WIDTH / pngDims.width;
      const imgWidth = pngDims.width * scale;
      const imgHeight = pngDims.height * scale;

      // Create a page sized to fit the full image (so vertical length is preserved)
      const page = pdfDoc.addPage([A4_WIDTH, imgHeight]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: imgWidth,
        height: imgHeight,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Production_Report_${viewDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast('Report PDF ready.');
    } catch (error) {
      console.error('Failed to create report PDF:', error);
      showToast('Failed to create PDF. Try again.');
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

  // Helper: Find the most recent raw material data before a given date
  const getLatestRawStockBefore = (date) => {
    let checkDate = getPreviousDateString(date);
    let maxIterations = 365; // Search up to 1 year back
    while (maxIterations > 0) {
      if (rawStock[checkDate]) {
        return rawStock[checkDate];
      }
      checkDate = getPreviousDateString(checkDate);
      maxIterations -= 1;
    }
    return null;
  };

  const getRawMaterialDataForDate = (date) => {
    if (rawStock[date]) return rawStock[date].items;
    
    // Search backwards for the most recent stock data
    const baseline = getLatestRawStockBefore(date);
    const prevMap = new Map((baseline?.items || []).map((i) => [i.desc, safeNum(i.closing)]));
    
    return RAW_MATERIALS_LIST.map((item, index) => {
      const opening = prevMap.get(item.desc) || 0;
      return {
        id: index,
        ...item,
        opening,
        receipt: 0,
        total: opening,
        issue: 0,
        closing: opening,
        remarks: '',
      };
    });
  };

  // Helper: Find the most recent finished stock data before a given date
  const getLatestFinishedStockBefore = (date) => {
    let checkDate = getPreviousDateString(date);
    let maxIterations = 365; // Search up to 1 year back
    while (maxIterations > 0) {
      if (finishedStock[checkDate]) {
        return finishedStock[checkDate];
      }
      checkDate = getPreviousDateString(checkDate);
      maxIterations -= 1;
    }
    return null;
  };

  const getFinishedStockDataForDate = (date) => {
    let items = finishedStock[date]?.items;
    
    if (!items) {
      // Search backwards for the most recent stock data
      const baseline = getLatestFinishedStockBefore(date);
      const prevItems = new Map((baseline?.items || []).map((i) => [i.size, safeNum(i.closing)]));
      const prevMortarClosing = safeNum(baseline?.mortarBag?.closing);
      const prevSummary = baseline?.summary || {};
      
      items = FINISHED_STOCK_SIZES.map((size, index) => {
        const opening = prevItems.get(size) || 0;
        return {
          id: index,
          size,
          opening,
          segregation: 0,
          sale: 0,
          proRejection: 0,
          loadingRejection: 0,
          selfUse: 0,
          closing: opening,
        };
      });
    } else {
      // If we already have data for this date, just use the items as-is
      items = finishedStock[date].items;
    }

    // For mortar bag, always search backwards if no data for this specific date
    const mortarBag = finishedStock[date]?.mortarBag || (() => {
      const baseline = getLatestFinishedStockBefore(date);
      const prevMortarClosing = safeNum(baseline?.mortarBag?.closing);
      return {
        opening: prevMortarClosing || 0,
        receipt: 0,
        sale: 0,
        closing: prevMortarClosing || 0,
      };
    })();

    // For summary, always search backwards if no data for this specific date
    const summary = finishedStock[date]?.summary || (() => {
      const baseline = getLatestFinishedStockBefore(date);
      const prevSummary = baseline?.summary || {};
      return {
        saleDaily: 0,
        productionDaily: 0,
        totalSale: safeNum(prevSummary.totalSale) || 0,
        totalProduction: safeNum(prevSummary.totalProduction) || 0,
        totalMortarSale: 0,
      };
    })();

    return { items, mortarBag, summary };
  };

  const rebuildRawStockChain = (stock, startDate, sourceItems) => {
    const nextStock = { ...stock };
    const sourceMap = new Map((Array.isArray(sourceItems) ? sourceItems : []).map((item) => [String(item?.desc || ''), item]));
    const dates = Object.keys(nextStock).filter((date) => date >= startDate).sort();
    if (!dates.includes(startDate)) {
      dates.unshift(startDate);
    }

    const baseline = (() => {
      let checkDate = getPreviousDateString(startDate);
      let iterations = 365;
      while (iterations > 0) {
        if (nextStock[checkDate]) return nextStock[checkDate];
        checkDate = getPreviousDateString(checkDate);
        iterations -= 1;
      }
      return null;
    })();

    let prevMap = new Map((baseline?.items || []).map((item) => [item.desc, safeNum(item.closing)]));

    for (const date of dates) {
      const sourceItemsForDate = date === startDate ? sourceItems : (nextStock[date]?.items || []);
      const daySourceMap = date === startDate ? sourceMap : new Map((Array.isArray(sourceItemsForDate) ? sourceItemsForDate : []).map((item) => [String(item?.desc || ''), item]));

      const rebuiltItems = RAW_MATERIALS_LIST.map((item, index) => {
        const source = daySourceMap.get(item.desc) || {};
        const opening = safeNum(prevMap.get(item.desc));
        const receipt = safeNum(source.receipt);
        const issue = safeNum(source.issue);
        const total = opening + receipt;
        const closing = total - issue;

        return {
          id: index,
          desc: item.desc,
          unit: item.unit,
          opening,
          receipt,
          total,
          issue,
          closing,
          remarks: String(source.remarks || ''),
        };
      });

      nextStock[date] = {
        ...(nextStock[date] || {}),
        items: rebuiltItems,
        timestamp: createTimestamp(),
      };
      prevMap = new Map(rebuiltItems.map((item) => [item.desc, safeNum(item.closing)]));
    }

    return nextStock;
  };

  const rebuildFinishedStockChain = (stock, startDate, sourcePayload) => {
    const nextStock = { ...stock };
    const dates = Object.keys(nextStock).filter((date) => date >= startDate).sort();
    if (!dates.includes(startDate)) {
      dates.unshift(startDate);
    }

    const baseline = (() => {
      let checkDate = getPreviousDateString(startDate);
      let iterations = 365;
      while (iterations > 0) {
        if (nextStock[checkDate]) return nextStock[checkDate];
        checkDate = getPreviousDateString(checkDate);
        iterations -= 1;
      }
      return null;
    })();

    let prevMap = new Map((baseline?.items || []).map((item) => [item.size, safeNum(item.closing)]));
    let prevMortarClosing = safeNum(baseline?.mortarBag?.closing);

    for (const date of dates) {
      const source = date === startDate ? sourcePayload : (nextStock[date] || {});
      const sourceItemMap = new Map((Array.isArray(source.items) ? source.items : []).map((item) => [String(item?.size || ''), item]));

      const rebuiltItems = FINISHED_STOCK_SIZES.map((size, index) => {
        const itemSource = sourceItemMap.get(size) || {};
        const opening = safeNum(prevMap.get(size));
        const segregation = safeNum(itemSource.segregation);
        const sale = safeNum(itemSource.sale);
        const proRejection = safeNum(itemSource.proRejection);
        const loadingRejection = safeNum(itemSource.loadingRejection);
        const selfUse = safeNum(itemSource.selfUse);
        const closing = (opening + segregation) - (sale + proRejection + loadingRejection + selfUse);

        return {
          id: index,
          size,
          opening,
          segregation,
          sale,
          proRejection,
          loadingRejection,
          selfUse,
          closing,
        };
      });

      const sourceMortar = source.mortarBag || {};
      const mortarBag = {
        opening: prevMortarClosing,
        receipt: safeNum(sourceMortar.receipt),
        sale: safeNum(sourceMortar.sale),
        closing: prevMortarClosing + safeNum(sourceMortar.receipt) - safeNum(sourceMortar.sale),
      };

      const summary = {
        ...(source.summary || {}),
        saleDaily: rebuiltItems.reduce((acc, item) => acc + safeNum(item.sale), 0),
      };

      nextStock[date] = {
        ...(nextStock[date] || {}),
        items: rebuiltItems,
        mortarBag,
        summary,
        timestamp: createTimestamp(),
      };

      prevMap = new Map(rebuiltItems.map((item) => [item.size, safeNum(item.closing)]));
      prevMortarClosing = safeNum(mortarBag.closing);
    }

    return nextStock;
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

    setRawStock((prev) => rebuildRawStockChain(prev, viewDate, newData));

    void updateRawStockDay(viewDate, newData).catch((error) => {
      console.error('Failed to persist raw stock update:', error);
    });

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

    setFinishedStock((prev) => rebuildFinishedStockChain(prev, viewDate, {
      items: newData,
      mortarBag,
      summary: newSummary,
    }));

    void updateFinishedStockDay(viewDate, {
      items: newData,
      mortarBag,
      summary: newSummary,
    }).catch((error) => {
      console.error('Failed to persist finished stock update:', error);
    });

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

    setFinishedStock((prev) => rebuildFinishedStockChain(prev, viewDate, {
      items,
      mortarBag: newMortar,
      summary,
    }));

    void updateFinishedStockDay(viewDate, {
      items,
      mortarBag: newMortar,
      summary,
    }).catch((error) => {
      console.error('Failed to persist mortar bag update:', error);
    });
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

    void updateFinishedStockDay(viewDate, {
      items,
      mortarBag,
      summary: newSummary,
    }).catch((error) => {
      console.error('Failed to persist production summary update:', error);
    });
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

    try {
      await deleteOrder(deleteConfirmId);
      setOrders((prev) => prev.filter((order) => order.id !== deleteConfirmId));
      logAction('DELETE ORDER', `Deleted Order ID: ${deleteConfirmId}`);
      showToast('Order deleted');
      setDeleteConfirmId(null);
    } catch (error) {
      showToast(error.message || 'Failed to delete order');
    }
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (!String(formData.vehicle || '').trim() || !String(formData.vehicleType || '').trim() || !String(formData.transporter || '').trim()) {
      showToast('Vehicle Number, Vehicle Type and Transporter are required.');
      return;
    }

    const toNumberOrZero = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const primaryQuantityUnit = formData.quantityUnit || 'CBM';
    const primaryQuantityRaw = String(formData.quantityValue ?? formData.cbm ?? '').trim();
    const primaryQuantityValue = primaryQuantityRaw === '' ? 0 : toNumberOrZero(primaryQuantityRaw);
    const primaryCbm = primaryQuantityUnit === 'PCS'
      ? convertPiecesToCbm(primaryQuantityValue, formData.size)
      : primaryQuantityValue;

    const additionalProducts = (formData.additionalProducts || [])
      .map((item) => {
        const quantity = toNumberOrZero(item.quantity);
        if (!quantity) return null;
        const unit = item.quantityUnit || 'CBM';
        const size = item.size || SIZES[3];
        const cbm = unit === 'PCS' ? convertPiecesToCbm(quantity, size) : quantity;
        return {
          size,
          quantity,
          quantityUnit: unit,
          cbm: Number(cbm.toFixed(3)),
          rate: toNumberOrZero(item.rate),
        };
      })
      .filter(Boolean);

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
      bjm: toNumberOrZero(formData.bjm),
      rate: toNumberOrZero(formData.rate),
      bjmRate: toNumberOrZero(formData.bjmRate),
      aacRateManualOverride: Boolean(formData.aacRateManualOverride),
      bjmRateManualOverride: Boolean(formData.bjmRateManualOverride),
      additionalProducts,
    };

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

    if (!String(manualDieselForm.purpose || '').trim()) {
      showToast('Purpose is required for in-plant diesel entries.');
      return;
    }

    const newEntry = {
      id: createId(),
      ...manualDieselForm,
      purpose: String(manualDieselForm.purpose || '').trim(),
      createdAt: createTimestamp(),
    };

    setDieselEntries((prev) => [newEntry, ...prev]);
    logAction('DIESEL ENTRY', `Added entry for ${manualDieselForm.name}`);
    showToast('In-Plant Entry Added');
    setManualDieselForm({ date: getTodayString(), name: '', location: '', purpose: '', driver: '', hsd: '' });
  };

  const handleBulkImport = async (data) => {
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
    }
  };

  const updateStatus = async (orderId, newStatus, extraData = {}) => {
    try {
      const updatedOrder = await transitionOrder(orderId, newStatus, extraData);
      setOrders((prev) => prev.map((order) => (order.id === orderId ? updatedOrder : order)));
      logAction('STATUS CHANGE', `Updated Order ${orderId} to ${newStatus}`);
      showToast('Status updated');
    } catch (error) {
      showToast(error.message || 'Failed to update status');
    }
  };

  const updateEntry = async (collectionName, id, field, value) => {
    let finalValue = value;

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
        await patchOrderAndSync(id, { [field]: finalValue });
      } catch (error) {
        showToast(error.message || `Failed to update ${field}`);
        return;
      }
    }

    if (collectionName === 'diesel_entries') {
      const dieselField = field === 'id' ? 'vehicle' : field;
      setDieselEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, [dieselField]: finalValue } : entry)));
    }

    logAction('INLINE EDIT', `Updated ${field} to ${finalValue} in ${collectionName}`);
    showToast(`${field} updated!`);
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

    try {
      await patchOrderAndSync(order.id, updates);
      logAction('RATE UPDATE', `Updated Truck Type/Rates for Order ${order.id}`);
      showToast('Type & Rates updated');
    } catch (error) {
      showToast(error.message || 'Failed to update truck type and rates');
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

    try {
      await patchOrderAndSync(order.id, { gsChecked: newGSState, loadingRate: newRate });
      logAction('GS TOGGLE', `Toggled GS for Order ${order.id}`);
      showToast(newGSState ? 'GS Added (+500)' : 'GS Removed');
    } catch (error) {
      showToast(error.message || 'Failed to update GS');
    }
  };

  const handleFileUpload = async (orderId, type, nextStatus, file = null) => {
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
      await updateStatus(previewFile.orderId, 'Approved');
      setPreviewFile(null);
    }
  };

  const handleDispatchSubmit = async (orderId, data) => {
    const latestOrder = orders.find((order) => order.id === orderId);
    if (latestOrder && latestOrder.status !== 'Approved') {
      showToast(`Cannot dispatch. Current status is ${latestOrder.status}. Refresh and try again.`);
      return;
    }

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

  const getDieselRegisterData = () => {
    const salesData = orders
      .filter((o) => o.hsd)
      .map((o) => ({
        id: o.id,
        date: o.orderDate,
        name: o.client,
        location: o.location,
        vehicle: o.vehicle,
        driver: o.driverName || '',
        purpose: o.purpose || 'Sales',
        km: o.tripKm || '-',
        hsd: o.hsd,
        type: 'Sales',
        collection: 'orders',
      }));

    const manualData = dieselEntries.map((e) => ({
      id: e.id,
      date: e.date,
      name: e.name,
      location: e.location,
      vehicle: e.vehicle || e.id || '',
      driver: e.driver,
      purpose: e.purpose || '',
      km: e.km || '-',
      hsd: e.hsd,
      type: 'In-Plant',
      collection: 'diesel_entries',
    }));

    return [...salesData, ...manualData].sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getLoadingReportData = () =>
    orders
      .filter((o) => o.status === 'Dispatched')
      .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
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
      .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
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
    return <LoginView onLogin={handleLogin} loading={authLoading} error={authError} demoUsers={TEMP_LOGINS} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 relative">
      {appMsg && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-bounce">{appMsg}</div>}
      {previewFile && (<DocPreviewModal fileType={previewFile.fileType} fileName={previewFile.fileName} fileUrl={previewFile.fileUrl} canApprove={previewFile.canApprove} onClose={() => setPreviewFile(null)} onApprove={handleApproveFromPreview} orderData={previewFile.orderData} />)}
      {deleteConfirmId && (<ConfirmModal title="Delete Order?" message="This action cannot be undone. Are you sure?" onConfirm={confirmDeleteOrder} onCancel={() => setDeleteConfirmId(null)} />)}
      {showImportModal && (<ImportModal onClose={() => setShowImportModal(false)} onImport={handleBulkImport} />)}
      {dispatchOrderObj && (<DispatchModal order={dispatchOrderObj} onClose={() => setDispatchModalOrderId(null)} onSubmit={handleDispatchSubmit} logs={logs} />)}
      {mtcModalOrderId && (
        <MtcModal
          orderId={mtcModalOrderId}
          onClose={() => setMtcModalOrderId(null)}
          onGenerate={async (orderId, testData) => {
            try {
              const updated = await generateMtc(orderId, testData);
              setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
              logAction('MTC GENERATED', `Generated MTC for Order ${orderId}`);
              showToast('MTC generated and uploaded');
            } catch (err) {
              console.error('Generate MTC failed', err);
              showToast(err?.message || 'Failed to generate MTC');
              throw err;
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
            onResetStock={handleResetProductionStock}
            FINISHED_STOCK_SIZES={FINISHED_STOCK_SIZES}
            canResetStock={role === 'management'}
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
