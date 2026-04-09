import { MongoClient } from 'mongodb';

import { COLLECTIONS } from './constants.js';
import { config } from './config.js';

let client;
let db;

export const connectToDatabase = async () => {
  if (db) return db;

  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.mongoDb);

  return db;
};

export const getDb = () => {
  if (!db) {
    throw new Error('Database has not been initialized.');
  }
  return db;
};

export const closeDatabase = async () => {
  if (client) {
    await client.close();
  }
};

export const collections = () => {
  const database = getDb();
  return {
    users: database.collection(COLLECTIONS.USERS),
    orders: database.collection(COLLECTIONS.ORDERS),
    orderEvents: database.collection(COLLECTIONS.ORDER_EVENTS),
    documents: database.collection(COLLECTIONS.DOCUMENTS),
    dieselEntries: database.collection(COLLECTIONS.DIESEL),
    rawStockDays: database.collection(COLLECTIONS.RAW_STOCK_DAYS),
    finishedStockDays: database.collection(COLLECTIONS.FINISHED_STOCK_DAYS),
    auditLogs: database.collection(COLLECTIONS.AUDIT_LOGS),
    appState: database.collection(COLLECTIONS.APP_STATE),
  };
};

export const ensureIndexes = async () => {
  const c = collections();

  await Promise.all([
    c.users.createIndex({ username: 1 }, { unique: true }),
    c.orders.createIndex({ status: 1 }),
    c.orders.createIndex({ orderDate: -1 }),
    c.orders.createIndex({ transporter: 1 }),
    c.orders.createIndex({ vehicle: 1 }),
    c.orderEvents.createIndex({ orderId: 1, createdAt: -1 }),
    c.documents.createIndex({ orderId: 1, type: 1, createdAt: -1 }),
    c.rawStockDays.createIndex({ date: 1 }, { unique: true }),
    c.finishedStockDays.createIndex({ date: 1 }, { unique: true }),
    c.auditLogs.createIndex({ createdAt: -1 }),
  ]);
};
