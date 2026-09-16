import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { createLoginLimiter } from '../middleware/rateLimit.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', createLoginLimiter(), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
    }
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, name, must_change_password FROM users WHERE email = $1',
      [String(email).toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    // Regenerate the session ID at the moment privilege is granted, so a
    // pre-auth session ID (e.g. planted via a fixation attack) is never
    // reused as an authenticated session.
    req.session.regenerate((regenErr) => {
      if (regenErr) return next(regenErr);
      req.session.userId = user.id;
      req.session.csrfToken = crypto.randomBytes(24).toString('hex');
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.json({
          user: { id: user.id, email: user.email, name: user.name, mustChangePassword: user.must_change_password },
          csrfToken: req.session.csrfToken
        });
      });
    });
  } catch (err) { next(err); }
});

router.post('/logout', verifyCsrf, (req, res, next) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('vv_sid');
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    const { rows } = await pool.query(
      'SELECT id, email, name, must_change_password FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'No autenticado.' });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, mustChangePassword: user.must_change_password },
      csrfToken: req.session.csrfToken
    });
  } catch (err) { next(err); }
});

router.post('/change-password', createLoginLimiter(), requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
    const user = rows[0];
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
    }
    const newHash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [newHash, req.session.userId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
