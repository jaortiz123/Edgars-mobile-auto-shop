module.exports = function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Server error';
  res.status(status).json({ error: message });
};
