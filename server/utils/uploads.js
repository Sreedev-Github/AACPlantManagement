import fs from 'fs';
import path from 'path';

import multer from 'multer';

import { config } from '../config.js';
import { httpError } from './httpError.js';

const ensureUploadRoot = () => {
  fs.mkdirSync(config.uploadDir, { recursive: true });
};

const isPdfFile = (file) => file.mimetype === 'application/pdf' || String(file.originalname || '').toLowerCase().endsWith('.pdf');

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    ensureUploadRoot();
    const orderId = req.params.id || 'misc';
    const type = req.uploadType || 'general';
    const targetDir = path.join(config.uploadDir, type, orderId);
    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeOriginal}`);
  },
});

export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (req.uploadType === 'invoices' && !isPdfFile(file)) {
      cb(httpError(400, 'Only PDF invoices are allowed.'));
      return;
    }

    cb(null, true);
  },
});
