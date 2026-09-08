import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { verifyPassword } from '../utils/password.js';
import { createLoginLimiter } from '../middleware/rateLimit.js';
import { verifyCsrf } from '../middleware/csrf.js';

const router = Router();

router.post('/login', createLoginLimiter(), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
    }
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, name FROM users WHERE email = $1',
      [String(email).toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    req.session.userId = user.id;
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    res.json({ user: { id: user.id, email: user.email, name: user.name }, csrfToken: req.session.csrfToken });
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
    const { rows } = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.session.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'No autenticado.' });
    res.json({ user: rows[0], csrfToken: req.session.csrfToken });
  } catch (err) { next(err); }
});

export default router;
