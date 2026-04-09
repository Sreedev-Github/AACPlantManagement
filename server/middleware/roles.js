export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const normalizedRole = String(req.user.role || '').toLowerCase();
  const normalizedAllowed = roles.map((role) => String(role).toLowerCase());

  if (!normalizedAllowed.includes(normalizedRole)) {
    return res.status(403).json({ message: 'You do not have permission for this action.' });
  }

  return next();
};
