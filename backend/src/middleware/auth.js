export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  next();
}

export function requireOwner(req, res, next) {
  if (!req.session || req.session.role !== 'owner') {
    return res.status(403).json({ error: 'Solo el owner puede realizar esta acción.' });
  }
  next();
}
