export const errorHandler = (err, _req, res, _next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  console.error('API Error:', err);
  return res.status(status).json({ message });
};

