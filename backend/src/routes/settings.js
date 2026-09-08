import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();
const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;

router.get('/logos', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT logo_agencia, logo_velarc FROM settings WHERE id = 1');
    res.json(rows[0] || { logo_agencia: null, logo_velarc: null });
  } catch (err) { next(err); }
});

router.put('/logos', async (req, res, next) => {
  try {
    const { logoAgencia, logoVelarc } = req.body;
    for (const [label, val] of [['agencia', logoAgencia], ['velarc', logoVelarc]]) {
      if (val && Buffer.byteLength(val, 'utf8') > MAX_LOGO_BYTES) {
        return res.status(400).json({ error: `El logo de ${label} es muy pesado (máx. ~1.5MB).` });
      }
    }
    const { rows } = await pool.query(
      `UPDATE settings SET
         logo_agencia = COALESCE($1, logo_agencia),
         logo_velarc = COALESCE($2, logo_velarc)
       WHERE id = 1 RETURNING logo_agencia, logo_velarc`,
      [logoAgencia ?? null, logoVelarc ?? null]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/logos/:key', async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!['agencia', 'velarc'].includes(key)) return res.status(400).json({ error: 'Logo inválido.' });
    const column = key === 'agencia' ? 'logo_agencia' : 'logo_velarc';
    const { rows } = await pool.query(`UPDATE settings SET ${column} = NULL WHERE id = 1 RETURNING logo_agencia, logo_velarc`);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
