import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { ROLES } from '../constants.js';
import { collections } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { httpError } from '../utils/httpError.js';

const router = Router();

const roleValues = Object.values(ROLES);

const buildToken = (user) => jwt.sign(
  {
    username: user.username,
    role: user.role,
  },
  config.jwtSecret,
  {
    subject: user._id.toString(),
    expiresIn: config.jwtExpiresIn,
  },
);

router.post('/auth/bootstrap', async (req, res, next) => {
  try {
    const setupKey = req.headers['x-setup-key'];
    const usersCol = collections().users;
    const existingCount = await usersCol.countDocuments();

    if (existingCount > 0 && setupKey !== process.env.ADMIN_SETUP_KEY) {
      throw httpError(403, 'Bootstrap is locked. Provide valid setup key.');
    }

    const users = Array.isArray(req.body?.users) ? req.body.users : [];
    if (users.length === 0) {
      throw httpError(400, 'users array is required.');
    }

    const now = new Date().toISOString();
    const docs = [];

    for (const item of users) {
      const username = String(item.username || '').trim().toLowerCase();
      const password = String(item.password || '');
      const role = String(item.role || '').trim().toLowerCase();

      if (!username || password.length < 6 || !roleValues.includes(role)) {
        throw httpError(400, `Invalid bootstrap user payload for username ${item.username || 'unknown'}.`);
      }

      const passwordHash = await bcrypt.hash(password, 10);
      docs.push({ username, role, passwordHash, createdAt: now, updatedAt: now });
    }

    for (const doc of docs) {
      await usersCol.updateOne(
        { username: doc.username },
        { $set: doc },
        { upsert: true },
      );
    }

    res.json({ ok: true, count: docs.length });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      throw httpError(400, 'username and password are required.');
    }

    const user = await collections().users.findOne({ username });
    if (!user) {
      throw httpError(401, 'Invalid username or password.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw httpError(401, 'Invalid username or password.');
    }

    const token = buildToken(user);

    res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/auth/me', requireAuth, async (req, res) => {
  res.json({
    user: {
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role,
    },
  });
});

export default router;
