import { randomUUID } from 'crypto';

import mysql from 'mysql2/promise';

import { COLLECTIONS } from './constants.js';
import { config } from './config.js';

let pool;
let initialized = false;

const isTrue = (value) => ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

const buildPoolConfig = () => {
  const parsed = new URL(config.sqlserver.url);
  const params = parsed.searchParams;

  const sslEnabled = isTrue(params.get('ssl') ?? params.get('DB_SSL') ?? 'true');

  return {
    host: parsed.hostname,
    port: Number(parsed.port || '3306'),
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database: parsed.pathname.replace(/^\//, ''),
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 20000,
  };
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database has not been initialized.');
  }

  return pool;
};

const nowIso = () => new Date().toISOString();

const toJson = (value) => JSON.stringify(value ?? null);

const fromJson = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
};

const stripInternalFields = (doc) => {
  const payload = { ...doc };
  delete payload.id;
  delete payload._id;
  return payload;
};

const normalizeStoredDoc = (row) => {
  if (!row) return null;

  const data = fromJson(row.data) || {};
  const id = String(row.id);

  return {
    ...data,
    id,
    _id: id,
    createdAt: data.createdAt || (row.created_at ? new Date(row.created_at).toISOString() : null),
    updatedAt: data.updatedAt || (row.updated_at ? new Date(row.updated_at).toISOString() : null),
  };
};

const matchesQuery = (doc, query = {}) => Object.entries(query).every(([key, value]) => {
  const lookupKey = key === '_id' ? 'id' : key;
  const actual = doc[lookupKey];

  if (value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, '$in')) {
    return Array.isArray(value.$in) && value.$in.some((candidate) => String(candidate) === String(actual));
  }

  return String(actual ?? '') === String(value ?? '');
});

const compareValues = (left, right) => {
  const a = left ?? '';
  const b = right ?? '';
  const aNumber = Number(a);
  const bNumber = Number(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a).localeCompare(String(b));
};

const sortDocs = (docs, sortSpec = {}) => {
  const entries = Object.entries(sortSpec);
  if (entries.length === 0) return docs;

  return [...docs].sort((left, right) => {
    for (const [field, direction] of entries) {
      const comparison = compareValues(left[field], right[field]);
      if (comparison !== 0) {
        return direction < 0 ? -comparison : comparison;
      }
    }

    return 0;
  });
};

const assertSafeTableName = (tableName) => {
  if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
    throw new Error(`Unsafe table name: ${tableName}`);
  }
};

const tableRef = (tableName) => {
  assertSafeTableName(tableName);
  return `\`${tableName}\``;
};

const readRows = async (tableName) => {
  if (tableName === 'app_users') {
    const [rows] = await getPool().query(`SELECT id, username, password_hash, role, created_at FROM ${tableRef(tableName)}`);
    return rows.map((row) => ({
      id: String(row.id),
      _id: String(row.id),
      username: row.username,
      passwordHash: row.password_hash,
      role: row.role,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.created_at).toISOString(),
    }));
  }
  if (tableName === 'app_state') {
    const [rows] = await getPool().query(`SELECT id, data, updated_at FROM ${tableRef(tableName)}`);
    return rows.map((row) => normalizeStoredDoc(row));
  }
  const [rows] = await getPool().query(`SELECT id, data, created_at, updated_at FROM ${tableRef(tableName)}`);
  return rows.map((row) => normalizeStoredDoc(row));
};

const writeDoc = async (tableName, doc) => {
  if (tableName === 'app_users') {
    const payload = stripInternalFields(doc);
    if (doc.id || doc._id) {
      const id = String(doc.id || doc._id);
      await getPool().query(
        `UPDATE ${tableRef(tableName)} SET username = ?, password_hash = ?, role = ? WHERE id = ?`,
        [payload.username, payload.passwordHash, payload.role, id]
      );
      return id;
    } else {
      const [result] = await getPool().query(
        `INSERT INTO ${tableRef(tableName)} (username, password_hash, role) VALUES (?, ?, ?)`,
        [payload.username, payload.passwordHash, payload.role]
      );
      return String(result.insertId);
    }
  }

  const id = String(doc.id || doc._id || randomUUID());
  const payload = stripInternalFields(doc);
  const now = nowIso();

  if (!payload.createdAt) payload.createdAt = now;
  payload.updatedAt = payload.updatedAt || now;

  if (tableName === 'app_state') {
    await getPool().query(
      `
        INSERT INTO ${tableRef(tableName)} (id, data, updated_at)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          data = VALUES(data),
          updated_at = VALUES(updated_at)
      `,
      [id, toJson(payload), payload.updatedAt],
    );
    return id;
  }

  await getPool().query(
    `
      INSERT INTO ${tableRef(tableName)} (id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        data = VALUES(data),
        updated_at = VALUES(updated_at)
    `,
    [id, toJson(payload), payload.createdAt, payload.updatedAt],
  );

  return id;
};

const deleteByIds = async (tableName, ids) => {
  if (ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(', ');
  const [result] = await getPool().query(
    `DELETE FROM ${tableRef(tableName)} WHERE id IN (${placeholders})`,
    ids,
  );

  return Number(result.affectedRows || 0);
};

class MysqlCollection {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async createIndex() {
    return undefined;
  }

  async insertOne(doc) {
    const insertedId = await writeDoc(this.tableName, doc);
    return { insertedId };
  }

  async findOne(query = {}) {
    const docs = await readRows(this.tableName);
    return docs.find((doc) => matchesQuery(doc, query)) || null;
  }

  find(query = {}) {
    let sortSpec = null;
    const collection = this;

    return {
      sort(spec) {
        sortSpec = spec || null;
        return this;
      },
      async toArray() {
        const docs = await readRows(collection.tableName);
        const filtered = docs.filter((doc) => matchesQuery(doc, query));
        return sortSpec ? sortDocs(filtered, sortSpec) : filtered;
      },
    };
  }

  async countDocuments(query = {}) {
    const docs = await readRows(this.tableName);
    return docs.filter((doc) => matchesQuery(doc, query)).length;
  }

  async updateOne(filter = {}, update = {}, options = {}) {
    const docs = await readRows(this.tableName);
    const existing = docs.find((doc) => matchesQuery(doc, filter));
    const set = update?.$set ? { ...update.$set } : {};

    if (existing) {
      const nextDoc = {
        ...existing,
        ...set,
        updatedAt: set.updatedAt || nowIso(),
      };
      await writeDoc(this.tableName, nextDoc);
      return { matchedCount: 1, modifiedCount: 1, upsertedId: null };
    }

    if (options?.upsert) {
      const nextDoc = {
        ...filter,
        ...set,
        updatedAt: set.updatedAt || nowIso(),
      };
      const insertedId = await writeDoc(this.tableName, nextDoc);
      return { matchedCount: 0, modifiedCount: 0, upsertedId: insertedId };
    }

    return { matchedCount: 0, modifiedCount: 0, upsertedId: null };
  }

  async deleteOne(filter = {}) {
    const docs = await readRows(this.tableName);
    const target = docs.find((doc) => matchesQuery(doc, filter));

    if (!target) {
      return { deletedCount: 0 };
    }

    const deletedCount = await deleteByIds(this.tableName, [target.id]);
    return { deletedCount };
  }

  async deleteMany(filter = {}) {
    const docs = await readRows(this.tableName);
    const ids = docs.filter((doc) => matchesQuery(doc, filter)).map((doc) => doc.id);
    const deletedCount = await deleteByIds(this.tableName, ids);
    return { deletedCount };
  }
}

const tableSchemas = Object.values(COLLECTIONS).map((tableName) => {
  assertSafeTableName(tableName);
  if (tableName === 'app_users') {
    return `
      CREATE TABLE IF NOT EXISTS ${tableRef(tableName)} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(120) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
  }
  return `
    CREATE TABLE IF NOT EXISTS ${tableRef(tableName)} (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      data JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
});

export const connectToDatabase = async () => {
  if (pool) return pool;

  pool = mysql.createPool(buildPoolConfig());

  return pool;
};

export const getDb = () => {
  if (!pool) {
    throw new Error('Database has not been initialized.');
  }

  return pool;
};

export const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    initialized = false;
  }
};

export const collections = () => {
  getDb();
  return {
    users: new MysqlCollection(COLLECTIONS.USERS),
    orders: new MysqlCollection(COLLECTIONS.ORDERS),
    orderEvents: new MysqlCollection(COLLECTIONS.ORDER_EVENTS),
    documents: new MysqlCollection(COLLECTIONS.DOCUMENTS),
    dieselEntries: new MysqlCollection(COLLECTIONS.DIESEL),
    rawStockDays: new MysqlCollection(COLLECTIONS.RAW_STOCK_DAYS),
    finishedStockDays: new MysqlCollection(COLLECTIONS.FINISHED_STOCK_DAYS),
    auditLogs: new MysqlCollection(COLLECTIONS.AUDIT_LOGS),
    appState: new MysqlCollection(COLLECTIONS.APP_STATE),
  };
};

export const ensureIndexes = async () => {
  if (initialized) return;

  await connectToDatabase();
  for (const statement of tableSchemas) {
    await getPool().query(statement);
  }
  initialized = true;
};
