import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, sort_order FROM service_lines ORDER BY sort_order, id');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre de la línea de servicio es requerido.' });
    const { rows } = await pool.query(
      `INSERT INTO service_lines (name, sort_order)
       SELECT $1, COALESCE(MAX(sort_order), -1) + 1 FROM service_lines
       RETURNING id, name, sort_order`,
      [name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre no puede quedar vacío.' });
    const { rows } = await pool.query(
      'UPDATE service_lines SET name = $1 WHERE id = $2 RETURNING id, name, sort_order',
      [name.trim(), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Línea de servicio no encontrada.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM service_lines WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Línea de servicio no encontrada.' });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
