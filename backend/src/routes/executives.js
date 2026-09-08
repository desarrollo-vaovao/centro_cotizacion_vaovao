import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM executives ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre del ejecutivo es requerido.' });
    const { rows } = await pool.query('INSERT INTO executives (name) VALUES ($1) RETURNING id, name', [name.trim()]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
