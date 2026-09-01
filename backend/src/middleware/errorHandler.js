// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: err.publicMessage || 'Ralat pelayan dalaman.',
  });
}

module.exports = errorHandler;
