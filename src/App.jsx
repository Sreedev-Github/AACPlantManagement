import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal, DispatchModal, DocPreviewModal, ImportModal } from './components/modals/AppModals';
import {
  AppHeader,
  DailyLogView,
  DetailedSalesReportView,
  DieselRegisterView,
  HomeView,
  LoginView,
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
  formatDateDisplay,
  formatDateTimeDisplay,
  getPreviousDateString,
  getTodayString,
  safeInt,
  safeNum,
} from './utils/appHelpers';
import {
  clearAuthToken,
  createOrder,
  dispatchOrder,
  deleteOrder,
  getCurrentUser,
  loadInitialState,
  loadOrders,
  login,
  saveDieselEntries,
  saveFinishedStock,
  saveLogs,
  saveRawStock,
  transitionOrder,
  uploadInvoice,
  updateDispatchedOrder,
  updateOrder,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('date');

  const [previewFile, setPreviewFile] = useState(null);
  const [dispatchModalOrderId, setDispatchModalOrderId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const [editingOrderId, setEditingOrderId] = useState(null);

  const [formData, setFormData] = useState({
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
      team: role.toUpperCase(),
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
    setSearchQuery('');
    setFilterMode('date');
  };

  const handleDownloadReport = () => {
    const csvEscape = (value) => {
      const text = String(value ?? '');
      if (!/[",\n]/.test(text)) return text;
      return `"${text.replace(/"/g, '""')}"`;
    };

    let headers = [];
    let rows = [];
    let reportName = '';

    if (productionTab === 'raw-material') {
      reportName = `RawMaterialStock_${viewDate}.csv`;
      headers = ['Sr No', 'Description', 'Unit', 'Opening', 'Receipt', 'Total', 'Issue', 'Closing', 'Remarks'];
      rows = getRawMaterialDataForDate(viewDate).map((item, idx) => [
        idx + 1,
        item.desc,
        item.unit,
        item.opening,
        item.receipt,
        item.total,
        item.issue,
        item.closing,
        item.remarks || '',
      ]);
    } else {
      reportName = `DailyProductionReport_${viewDate}.csv`;
      const finishedData = getFinishedStockDataForDate(viewDate);
      headers = ['SL No', 'Size', 'Opening', 'Segregation', 'Sale', 'Pro Rejection', 'Load Rejection', 'Self Use & Others', 'Closing'];
      rows = finishedData.items.map((item, idx) => [
        idx + 1,
        item.size,
        item.opening,
        item.segregation,
        item.sale,
        item.proRejection,
        item.loadingRejection,
        item.selfUse,
        item.closing,
      ]);

      rows.push([]);
      rows.push(['Section', 'Metric', 'Value']);
      rows.push(['Mortar Bag', 'Opening', finishedData.mortarBag.opening]);
      rows.push(['Mortar Bag', 'Receipt', finishedData.mortarBag.receipt]);
      rows.push(['Mortar Bag', 'Sale', finishedData.mortarBag.sale]);
      rows.push(['Mortar Bag', 'Closing', finishedData.mortarBag.closing]);
      rows.push([]);
      rows.push(['Summary', 'Sale Daily', finishedData.summary.saleDaily]);
      rows.push(['Summary', 'Production Daily', finishedData.summary.productionDaily]);
      rows.push(['Summary', 'Total Sale', finishedData.summary.totalSale]);
      rows.push(['Summary', 'Total Production', finishedData.summary.totalProduction]);
      rows.push(['Summary', 'Total Mortar Sale', finishedData.summary.totalMortarSale]);
    }

    const csvLines = [headers.map(csvEscape).join(',')];
    rows.forEach((row) => csvLines.push(row.map(csvEscape).join(',')));

    const blob = new Blob([`${csvLines.join('\n')}\n`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = reportName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showToast('Report downloaded successfully.');
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val) {
      setFilterMode('search');
      if (view !== 'daily-log') setView('daily-log');
    } else {
      setFilterMode('date');
    }
  };

  const injectTestData = async () => {
    showToast('Generating test data...');
    const todayStr = getTodayString();

    const testDiesel = {
      id: createId(),
      date: todayStr,
      name: 'Generator 1',
      location: 'Plant A',
      driver: 'Operator Raj',
      hsd: '50',
      createdAt: createTimestamp(),
    };

    const testOrders = [
      {
        id: createId(),
        client: 'Test Client A',
        location: 'Site X',
        vehicle: 'ABC-9999',
        transporter: 'ABC',
        size: SIZES[0],
        cbm: 20,
        bjm: 5,
        rate: 4500,
        bjmRate: 10,
        status: 'Dispatched',
        orderDate: todayStr,
        createdBy: user.uid,
        createdAt: createTimestamp(),
        dispatchSlip: 'slip-a.jpg',
        invoice: 'inv-a.pdf',
        truckType: 12,
        netWt: 25.0,
        grossWeight: 35.0,
        tareWeight: 10.0,
        loadingBy: 'Team A',
        unloadingBy: 'Team B',
        hsd: 120,
        driverName: 'Driver Singh',
        tripKm: 450,
        gsChecked: true,
        loadingRate: 1900,
        unloadingRate: 2200,
      },
      {
        id: createId(),
        client: 'Test Client B',
        location: 'Site Y',
        vehicle: 'MH-1000',
        transporter: 'Logistix',
        size: SIZES[2],
        cbm: 15,
        bjm: 3,
        rate: 5000,
        bjmRate: 8,
        status: 'Loading Complete',
        orderDate: todayStr,
        createdBy: user.uid,
        createdAt: createTimestamp(),
        truckType: 10,
        loadingRate: 1000,
        gsChecked: false,
      },
      {
        id: createId(),
        client: 'Test Client C',
        location: 'Site Z',
        vehicle: 'DL-2000',
        transporter: 'Freight Co',
        size: SIZES[4],
        cbm: 30,
        bjm: 10,
        rate: 4000,
        bjmRate: 15,
        status: 'Invoiced',
        orderDate: todayStr,
        createdBy: user.uid,
        createdAt: createTimestamp(),
        truckType: 14,
        loadingRate: 1600,
        gsChecked: false,
        invoice: 'inv-c.pdf',
      },
      {
        id: createId(),
        client: 'Test Client D',
        location: 'Site W',
        vehicle: 'KA-3000',
        transporter: 'ABC',
        size: SIZES[6],
        cbm: 22,
        bjm: 7,
        rate: 6000,
        bjmRate: 12,
        status: 'Awaiting Truck',
        orderDate: todayStr,
        createdBy: user.uid,
        createdAt: createTimestamp(),
        truckType: 6,
        loadingRate: 800,
        unloadingRate: 1000,
        gsChecked: false,
      },
    ];

    try {
      const createdOrders = await Promise.all(testOrders.map(({ id, ...orderPayload }) => createOrder(orderPayload)));
      setDieselEntries((prev) => [testDiesel, ...prev]);
      setOrders((prev) => [...createdOrders, ...prev]);

      logAction('TEST DATA', `Generated ${createdOrders.length} test orders and 1 diesel entry`);
      showToast('Test Data Added.');
    } catch (error) {
      showToast(error.message || 'Failed to generate test data');
    }
  };

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
      client: order.client,
      location: order.location,
      gstin: order.gstin || '',
      vehicle: order.vehicle,
      vehicleType: order.vehicleType || '',
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
      client: String(formData.client || '').trim(),
      location: String(formData.location || '').trim(),
      gstin: String(formData.gstin || '').trim(),
      vehicle: String(formData.vehicle || '').trim(),
      vehicleType: String(formData.vehicleType || '').trim(),
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
    setSearchQuery('');
    setFormData({
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

    const newEntry = {
      id: createId(),
      ...manualDieselForm,
      createdAt: createTimestamp(),
    };

    setDieselEntries((prev) => [newEntry, ...prev]);
    logAction('DIESEL ENTRY', `Added entry for ${manualDieselForm.name}`);
    showToast('In-Plant Entry Added');
    setManualDieselForm({ date: getTodayString(), name: '', location: '', driver: '', hsd: '' });
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
    const tType = parseInt(String(newTypeVal).replace(/\D/g, ''), 10);
    let updates = { truckType: newTypeVal };
    let newLoadRate = 0;
    let newUnloadRate = 0;

    if (!Number.isNaN(tType) && tType > 0) {
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
  if (filterMode === 'search') {
    const lowerQ = searchQuery.toLowerCase();
    displayedOrders = orders.filter((o) => (o.client || '').toLowerCase().includes(lowerQ) || (o.vehicle || '').toLowerCase().includes(lowerQ));
  } else if (filterMode === 'date') {
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
    setSearchQuery('');
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

      <AppHeader
        role={role}
        setViewAndFilter={setViewAndFilter}
        searchQuery={searchQuery}
        handleSearch={handleSearch}
        injectTestData={injectTestData}
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
            SIZES={SIZES}
          />
        )}

        {view === 'daily-log' && (
          <DailyLogView
            filterMode={filterMode}
            handleDateChange={handleDateChange}
            setViewAndFilter={setViewAndFilter}
            searchQuery={searchQuery}
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
            handleFileUpload={handleFileUpload}
          />
        )}
      </main>
    </div>
  );
}
