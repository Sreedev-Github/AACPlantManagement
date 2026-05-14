import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';

import { config } from './config.js';
import { closeDatabase, connectToDatabase, ensureIndexes } from './db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import documentsRouter from './routes/documents.js';
import healthRouter from './routes/health.js';
import legacyStateRouter from './routes/legacyState.js';
import ordersRouter from './routes/orders.js';
import productionRouter from './routes/production.js';

dotenv.config();

const app = express();
const port = config.port;

const parseAllowedOrigins = () => {
  const raw = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '';
  return String(raw)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

if (config.nodeEnv === 'production' && allowedOrigins.length === 0) {
  console.warn('CORS_ORIGIN is not set. API is currently allowing all origins.');
}

const corsOptions = allowedOrigins.length === 0
  ? {}
  : {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        const error = new Error('Origin not allowed by CORS');
        error.statusCode = 403;
        callback(error);
      },
    };

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.resolve(config.uploadDir)));

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', ordersRouter);
app.use('/api', productionRouter);
app.use('/api', documentsRouter);
app.use('/api', legacyStateRouter);

app.use(errorHandler);

const start = async () => {
  try {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    await connectToDatabase();
    await ensureIndexes();

    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});
