import React, { createContext, useContext, useState, useEffect } from 'react';
import { ordersDB, dieselDB, logsDB, rawStockDB, finishedStockDB } from '../utils/localStorage';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [role, setRole] = useState(null);
  const [orders, setOrders] = useState([]);
  const [dieselEntries, setDieselEntries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [rawStock, setRawStock] = useState({});
  const [finishedStock, setFinishedStock] = useState({});
  const [appMsg, setAppMsg] = useState(null);

  // Load data from localStorage on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = () => {
    setOrders(ordersDB.getAll());
    setDieselEntries(dieselDB.getAll());
    setLogs(logsDB.getAll());
    
    // Load all stock data into objects keyed by date
    const rawStockData = {};
    rawStockDB.getAll().forEach(stock => {
      rawStockData[stock.date] = stock;
    });
    setRawStock(rawStockData);
    
    const finishedStockData = {};
    finishedStockDB.getAll().forEach(stock => {
      finishedStockData[stock.date] = stock;
    });
    setFinishedStock(finishedStockData);
  };

  const showToast = (msg) => {
    setAppMsg(msg);
    setTimeout(() => setAppMsg(null), 3000);
  };

  const logAction = (action, details) => {
    if (!role) return;
    const log = logsDB.add({
      action,
      details,
      team: role.toUpperCase(),
      user: 'local-user',
    });
    setLogs(prev => [log, ...prev]);
  };

  // Orders operations
  const addOrder = (orderData) => {
    const newOrder = ordersDB.add(orderData);
    setOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

  const updateOrder = (id, updates) => {
    const updated = ordersDB.update(id, updates);
    if (updated) {
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
    }
    return updated;
  };

  const deleteOrder = (id) => {
    ordersDB.delete(id);
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  // Diesel entries operations
  const addDieselEntry = (entryData) => {
    const newEntry = dieselDB.add(entryData);
    setDieselEntries(prev => [newEntry, ...prev]);
    return newEntry;
  };

  // Stock operations
  const updateRawStockForDate = (date, data) => {
    const updated = rawStockDB.set(date, data);
    setRawStock(prev => ({
      ...prev,
      [date]: updated
    }));
  };

  const updateFinishedStockForDate = (date, data) => {
    const updated = finishedStockDB.set(date, data);
    setFinishedStock(prev => ({
      ...prev,
      [date]: updated
    }));
  };

  const value = {
    role,
    setRole,
    orders,
    dieselEntries,
    logs,
    rawStock,
    finishedStock,
    appMsg,
    showToast,
    logAction,
    addOrder,
    updateOrder,
    deleteOrder,
    addDieselEntry,
    updateRawStockForDate,
    updateFinishedStockForDate,
    loadAllData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
