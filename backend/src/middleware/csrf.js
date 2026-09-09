const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const token = req.header('X-CSRF-Token');
  if (!token || !req.session || !req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Token CSRF inválido o ausente.' });
  }
  next();
}
