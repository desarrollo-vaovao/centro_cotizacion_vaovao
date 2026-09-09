import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

function slugCode(name) {
  return (name || '').trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CLI';
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, code, name, country, contact_name, contact_email, contact_phone, seq FROM clients ORDER BY name'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, country, contactName, contactEmail, contactPhone } = req.body;
    let code = (req.body.code || '').trim().toUpperCase();
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre del cliente es requerido.' });
    if (!country) return res.status(400).json({ error: 'El país es requerido.' });
    if (!code) code = slugCode(name);
    const existing = await pool.query('SELECT id FROM clients WHERE code = $1', [code]);
    if (existing.rows.length) return res.status(409).json({ error: 'Ese código de cliente ya existe.' });
    const { rows } = await pool.query(
      `INSERT INTO clients (code, name, country, contact_name, contact_email, contact_phone, seq)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       RETURNING id, code, name, country, contact_name, contact_email, contact_phone, seq`,
      [code, name.trim(), country, contactName || null, contactEmail || null, contactPhone || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name, country, contactName, contactEmail, contactPhone } = req.body;
    const { rows } = await pool.query(
      `UPDATE clients SET
         name = COALESCE($1, name),
         country = COALESCE($2, country),
         contact_name = COALESCE($3, contact_name),
         contact_email = COALESCE($4, contact_email),
         contact_phone = COALESCE($5, contact_phone)
       WHERE id = $6
       RETURNING id, code, name, country, contact_name, contact_email, contact_phone, seq`,
      [name || null, country || null, contactName || null, contactEmail || null, contactPhone || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'No se puede eliminar: el cliente tiene cotizaciones asociadas.' });
    next(err);
  }
});

export default router;
