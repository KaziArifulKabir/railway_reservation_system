function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = Number(error.status) || 500;
  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected server error occurred.'
      : (error.message || 'Something went wrong.'),
    ...(process.env.NODE_ENV !== 'production' && error.code ? { code: error.code } : {})
  });
}

module.exports = { notFound, errorHandler };
