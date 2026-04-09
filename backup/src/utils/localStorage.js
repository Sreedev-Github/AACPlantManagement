// Local Storage Service for frontend persistence
import { getTodayString } from './helpers';

const STORAGE_KEYS = {
  ORDERS: 'aac_orders',
  DIESEL_ENTRIES: 'aac_diesel_entries',
  LOGS: 'aac_logs',
  RAW_MATERIAL_STOCK: 'aac_raw_material_stock',
  FINISHED_STOCK: 'aac_finished_stock',
};

// Helper to generate unique IDs
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Get data from localStorage
const getData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return [];
  }
};

// Save data to localStorage
const saveData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
    return false;
  }
};

// Orders operations
export const ordersDB = {
  getAll: () => {
    return getData(STORAGE_KEYS.ORDERS).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  },
  
  add: (order) => {
    const orders = getData(STORAGE_KEYS.ORDERS);
    const newOrder = {
      ...order,
      id: generateId(),
      createdAt: Date.now(),
    };
    orders.push(newOrder);
    saveData(STORAGE_KEYS.ORDERS, orders);
    return newOrder;
  },
  
  update: (id, updates) => {
    const orders = getData(STORAGE_KEYS.ORDERS);
    const index = orders.findIndex(o => o.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      saveData(STORAGE_KEYS.ORDERS, orders);
      return orders[index];
    }
    return null;
  },
  
  delete: (id) => {
    const orders = getData(STORAGE_KEYS.ORDERS);
    const filtered = orders.filter(o => o.id !== id);
    saveData(STORAGE_KEYS.ORDERS, filtered);
    return true;
  },
};

// Diesel entries operations
export const dieselDB = {
  getAll: () => {
    return getData(STORAGE_KEYS.DIESEL_ENTRIES).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  },
  
  add: (entry) => {
    const entries = getData(STORAGE_KEYS.DIESEL_ENTRIES);
    const newEntry = {
      ...entry,
      id: generateId(),
      createdAt: Date.now(),
    };
    entries.push(newEntry);
    saveData(STORAGE_KEYS.DIESEL_ENTRIES, entries);
    return newEntry;
  },
};

// Logs operations
export const logsDB = {
  getAll: () => {
    return getData(STORAGE_KEYS.LOGS).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  },
  
  add: (log) => {
    const logs = getData(STORAGE_KEYS.LOGS);
    const newLog = {
      ...log,
      id: generateId(),
      timestamp: Date.now(),
    };
    logs.push(newLog);
    saveData(STORAGE_KEYS.LOGS, logs);
    return newLog;
  },
};

// Raw material stock operations
export const rawStockDB = {
  get: (date) => {
    const allStock = getData(STORAGE_KEYS.RAW_MATERIAL_STOCK);
    return allStock.find(s => s.date === date) || null;
  },
  
  set: (date, data) => {
    const allStock = getData(STORAGE_KEYS.RAW_MATERIAL_STOCK);
    const index = allStock.findIndex(s => s.date === date);
    
    const stockData = {
      date,
      ...data,
      timestamp: Date.now(),
    };
    
    if (index !== -1) {
      allStock[index] = stockData;
    } else {
      allStock.push(stockData);
    }
    
    saveData(STORAGE_KEYS.RAW_MATERIAL_STOCK, allStock);
    return stockData;
  },
  
  getAll: () => {
    return getData(STORAGE_KEYS.RAW_MATERIAL_STOCK);
  },
};

// Finished stock operations
export const finishedStockDB = {
  get: (date) => {
    const allStock = getData(STORAGE_KEYS.FINISHED_STOCK);
    return allStock.find(s => s.date === date) || null;
  },
  
  set: (date, data) => {
    const allStock = getData(STORAGE_KEYS.FINISHED_STOCK);
    const index = allStock.findIndex(s => s.date === date);
    
    const stockData = {
      date,
      ...data,
      timestamp: Date.now(),
    };
    
    if (index !== -1) {
      allStock[index] = stockData;
    } else {
      allStock.push(stockData);
    }
    
    saveData(STORAGE_KEYS.FINISHED_STOCK, allStock);
    return stockData;
  },
  
  getAll: () => {
    return getData(STORAGE_KEYS.FINISHED_STOCK);
  },
};

// Initialize with test data if needed
export const initializeTestData = () => {
  const todayStr = getTodayString();
  
  // Add test diesel entry
  dieselDB.add({
    date: todayStr,
    name: 'Generator 1',
    location: 'Plant A',
    driver: 'Operator Raj',
    hsd: '50',
  });
  
  // Add test orders with various statuses
  ordersDB.add({
    client: 'Test Client A',
    location: 'Site X',
    vehicle: 'ABC-9999',
    transporter: 'ABC',
    size: "600x200x75",
    cbm: 20,
    bjm: 5,
    rate: 4500,
    bjmRate: 10,
    status: 'Dispatched',
    orderDate: todayStr,
    dispatchSlip: 'slip-a.jpg',
    invoice: 'inv-a.pdf',
    truckType: 12,
    netWt: 25.000,
    grossWeight: 35.000,
    tareWeight: 10.000,
    loadingBy: 'Team A',
    unloadingBy: 'Team B',
    hsd: 120,
    driverName: 'Driver Singh',
    tripKm: 450,
    gsChecked: true,
    loadingRate: 1900,
    unloadingRate: 2200,
  });
  
  ordersDB.add({
    client: 'Test Client B',
    location: 'Site Y',
    vehicle: 'MH-1000',
    transporter: 'Logistix',
    size: "600x200x125",
    cbm: 15,
    bjm: 3,
    rate: 5000,
    bjmRate: 8,
    status: 'Loading Complete',
    orderDate: todayStr,
    truckType: 10,
    loadingRate: 1000,
    gsChecked: false,
  });
  
  ordersDB.add({
    client: 'Test Client C',
    location: 'Site Z',
    vehicle: 'DL-2000',
    transporter: 'Freight Co',
    size: "600x200x200",
    cbm: 30,
    bjm: 10,
    rate: 4000,
    bjmRate: 15,
    status: 'Invoiced',
    orderDate: todayStr,
    truckType: 14,
    loadingRate: 1600,
    gsChecked: false,
    invoice: 'inv-c.pdf',
  });
  
  ordersDB.add({
    client: 'Test Client D',
    location: 'Site W',
    vehicle: 'KA-3000',
    transporter: 'ABC',
    size: "600x200x250",
    cbm: 22,
    bjm: 7,
    rate: 6000,
    bjmRate: 12,
    status: 'Awaiting Truck',
    orderDate: todayStr,
    truckType: 6,
    loadingRate: 800,
    unloadingRate: 1000,
    gsChecked: false,
  });
};

export default {
  ordersDB,
  dieselDB,
  logsDB,
  rawStockDB,
  finishedStockDB,
  initializeTestData,
};
