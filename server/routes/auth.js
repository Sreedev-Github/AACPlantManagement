import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { ROLES, normalizeRole } from '../constants.js';
import { collections } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { httpError } from '../utils/httpError.js';

const router = Router();

const roleValues = Object.values(ROLES);
const DEFAULT_TEAM_PASSWORD = 'ashpro@123';
const DEFAULT_TEAM_USERS = [
  { username: 'sale', role: ROLES.SALES },
  { username: 'site', role: ROLES.LOADING },
  { username: 'account', role: ROLES.ACCOUNTS },
  { username: 'management', role: ROLES.MANAGEMENT },
  { username: 'production', role: ROLES.PRODUCTION },
];
const LEGACY_TEAM_USERS = ['sales1', 'loading1', 'accounts1', 'manager1', 'prod1'];
const PASSWORD_MANAGEMENT_ROLES = new Set([ROLES.SALES, ROLES.LOADING, ROLES.ACCOUNTS, ROLES.PRODUCTION]);
const TEMP_TEAM_USER_PATTERN = /^(?:smoke|diag|debug)_loading_\d+$/i;

const buildToken = (user) => jwt.sign(
  {
    username: user.username,
    role: normalizeRole(user.role),
  },
  config.jwtSecret,
  {
    subject: user._id.toString(),
    expiresIn: config.jwtExpiresIn,
  },
);

const serializeUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  role: normalizeRole(user.role),
});

const ensureDefaultTeamUsers = async () => {
  const usersCol = collections().users;
  const now = new Date().toISOString();

  // await usersCol.updateOne({ username: 'loading' }, { $set: { username: 'site' } }); // Legacy migration for 'loading' user to 'site'

  for (let index = 0; index < DEFAULT_TEAM_USERS.length; index += 1) {
    const seed = DEFAULT_TEAM_USERS[index];
    const existing = await usersCol.findOne({ username: seed.username });
    if (existing) {
      continue;
    }

    const legacyUsername = LEGACY_TEAM_USERS[index];
    const legacy = await usersCol.findOne({ username: legacyUsername });
    const passwordHash = await bcrypt.hash(DEFAULT_TEAM_PASSWORD, 10);

    if (legacy) {
      await usersCol.updateOne(
        { _id: legacy._id },
        {
          $set: {
            username: seed.username,
            role: seed.role,
            passwordHash,
            updatedAt: now,
          },
        },
      );
      continue;
    }

    await usersCol.insertOne({
      username: seed.username,
      role: seed.role,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  await usersCol.deleteMany({ username: { $in: LEGACY_TEAM_USERS } });
  await usersCol.deleteMany({ username: { $regex: TEMP_TEAM_USER_PATTERN } });
};

router.post('/auth/bootstrap', async (req, res, next) => {
  try {
    const setupKey = req.headers['x-setup-key'];
    const usersCol = collections().users;
    const existingCount = await usersCol.countDocuments();

    if (existingCount > 0 && setupKey !== (globalThis.process && globalThis.process.env ? globalThis.process.env.ADMIN_SETUP_KEY : undefined)) {
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
    await ensureDefaultTeamUsers();

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
        ...serializeUser(user),
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

router.get('/auth/users', requireAuth, requireRoles(ROLES.MANAGEMENT), async (_req, res, next) => {
  try {
    await ensureDefaultTeamUsers();
    const users = await collections().users.find({}).sort({ role: 1, username: 1 }).toArray();
    res.json({
      users: users
        .map(serializeUser)
        .filter((user) => PASSWORD_MANAGEMENT_ROLES.has(normalizeRole(user.role))),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/auth/users/:id', requireAuth, requireRoles(ROLES.MANAGEMENT), async (req, res, next) => {
  try {
    await ensureDefaultTeamUsers();

    const targetId = String(req.params.id || '').trim();
    if (!targetId) {
      throw httpError(400, 'Invalid user id.');
    }

    const usersCol = collections().users;
    const user = await usersCol.findOne({ _id: targetId });
    if (!user) {
      throw httpError(404, 'User not found.');
    }

    const nextUsername = String(req.body?.username || '').trim().toLowerCase();
    const nextPassword = String(req.body?.password || '');
    const currentPassword = String(req.body?.currentPassword || '');
    const updates = {};

    if (nextUsername && nextUsername !== user.username) {
      const existing = await usersCol.findOne({ username: nextUsername });
      if (existing && String(existing._id) !== String(user._id)) {
        throw httpError(409, 'Username already exists.');
      }
      updates.username = nextUsername;
    }

    if (nextPassword) {
      if (normalizeRole(user.role) === ROLES.MANAGEMENT) {
        if (!currentPassword) {
          throw httpError(400, 'Current management password is required.');
        }

        const validCurrentPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validCurrentPassword) {
          throw httpError(401, 'Current management password is incorrect.');
        }
      }

      updates.passwordHash = await bcrypt.hash(nextPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      throw httpError(400, 'Provide a username or password update.');
    }

    updates.updatedAt = new Date().toISOString();

    await usersCol.updateOne(
      { _id: user._id },
      { $set: updates },
    );

    const updated = await usersCol.findOne({ _id: user._id });
    res.json({ user: serializeUser(updated) });
  } catch (error) {
    next(error);
  }
});

export default router;
