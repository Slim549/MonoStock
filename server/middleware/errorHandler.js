function errorHandler(err, req, res, _next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${err.message}`);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
}

module.exports = { errorHandler };
