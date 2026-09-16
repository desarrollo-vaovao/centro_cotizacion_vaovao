import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, generateTempPassword } from '../utils/password.js';
import { requireOwner } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role FROM users ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', requireOwner, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!email || !email.trim()) return res.status(400).json({ error: 'El correo es requerido.' });
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, 'executive', true)
       RETURNING id, name, email, role`,
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );
    res.status(201).json({ ...rows[0], tempPassword });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese correo ya está en uso.' });
    next(err);
  }
});

router.post('/:id/reset-password', requireOwner, async (req, res, next) => {
  try {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const { rowCount } = await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2',
      [passwordHash, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json({ tempPassword });
  } catch (err) { next(err); }
});

router.delete('/:id', requireOwner, async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.session.userId)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
    }
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'No se puede eliminar: el usuario tiene cotizaciones asociadas.' });
    next(err);
  }
});

export default router;
