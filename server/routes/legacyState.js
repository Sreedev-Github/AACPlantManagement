import { Router } from 'express';

import { STATE_DOC_ID, STATE_KEYS } from '../constants.js';
import { collections } from '../db.js';

const router = Router();

const ensureStateDocument = async () => {
  const col = collections().appState;
  const existing = await col.findOne({ _id: STATE_DOC_ID });
  if (existing) return existing;

  const doc = {
    _id: STATE_DOC_ID,
    orders: [],
    dieselEntries: [],
    logs: [],
    rawStock: {},
    finishedStock: {},
    updatedAt: new Date().toISOString(),
  };

  await col.insertOne(doc);
  return doc;
};

const stripMeta = (doc) => {
  const { _id, updatedAt, ...state } = doc;
  return state;
};

router.get('/state', async (_req, res) => {
  try {
    const stateDoc = await ensureStateDocument();
    res.json(stripMeta(stateDoc));
  } catch (error) {
    res.status(500).json({ message: 'Failed to load state', error: error.message });
  }
});

router.put('/state/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!STATE_KEYS.includes(key)) {
      return res.status(400).json({ message: `Invalid state key: ${key}` });
    }

    await ensureStateDocument();

    await collections().appState.updateOne(
      { _id: STATE_DOC_ID },
      {
        $set: {
          [key]: req.body?.value,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update state', error: error.message });
  }
});

export default router;
