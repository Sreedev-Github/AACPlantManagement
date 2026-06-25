import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { normalizeRole } from '../constants.js';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = {
      userId: payload.sub,
      username: payload.username,
      role: normalizeRole(payload.role),
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
