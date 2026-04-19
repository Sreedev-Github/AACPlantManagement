import path from 'path';
import { Router } from 'express';

import { collections } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { httpError } from '../utils/httpError.js';

const router = Router();

router.use('/documents', requireAuth);

router.get('/documents/:id/download', async (req, res, next) => {
  try {
    const id = String(req.params.id || '');
    const document = await collections().documents.findOne({ filename: id });

    if (!document) {
      throw httpError(404, 'Document not found.');
    }

    res.download(path.resolve(document.path), document.originalName || document.filename);
  } catch (error) {
    next(error);
  }
});

export default router;
