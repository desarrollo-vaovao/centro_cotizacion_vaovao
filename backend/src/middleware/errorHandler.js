export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  const status = err.status || 500;
  // Only surface err.message to the client for deliberately-thrown, client-facing
  // errors (status explicitly set and in the 4xx range). Any error that reaches
  // here without a 4xx status is an unexpected/internal failure (often a raw
  // Postgres or Node error) and must not leak its message to the client.
  const message = (err.status && err.status < 500) ? (err.message || 'Error interno del servidor.') : 'Error interno del servidor.';
  res.status(status).json({ error: message });
}
