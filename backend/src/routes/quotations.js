import { Router } from 'express';
import { pool } from '../db.js';
import { buildGeneralCorrelativo, buildClientCorrelativo, withVersionSuffix } from '../utils/correlativo.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { clientId, executiveId, estatus } = req.query;
    const clauses = [];
    const params = [];
    if (clientId) { params.push(clientId); clauses.push(`client_id = $${params.length}`); }
    if (executiveId) { params.push(executiveId); clauses.push(`executive_id = $${params.length}`); }
    if (estatus) { params.push(estatus); clauses.push(`estatus = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT * FROM quotations ${where} ORDER BY fecha DESC, id DESC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const b = req.body;
    if (!b.clientId && !b.clienteNombreLibre) return res.status(400).json({ error: 'Selecciona o crea un cliente.' });
    if (!b.executiveId) return res.status(400).json({ error: 'Selecciona o crea un ejecutivo.' });
    if (!b.proyecto || !b.proyecto.trim()) return res.status(400).json({ error: 'Ingresa el nombre del proyecto.' });
    if (!Array.isArray(b.detalle) || !b.detalle.filter(Boolean).length) return res.status(400).json({ error: 'Agrega al menos una línea de detalle.' });
    const monto = Number(b.monto);
    if (!monto || monto <= 0) return res.status(400).json({ error: 'Ingresa un monto válido.' });

    await client.query('BEGIN');
    const year = new Date().getFullYear();
    const settingsRes = await client.query('UPDATE settings SET general_seq = general_seq + 1 WHERE id = 1 RETURNING general_seq');
    const correlativoGeneral = buildGeneralCorrelativo(year, settingsRes.rows[0].general_seq);

    let correlativoCliente = null;
    if (b.clientId) {
      const clientRes = await client.query('UPDATE clients SET seq = seq + 1 WHERE id = $1 RETURNING code, seq', [b.clientId]);
      if (!clientRes.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Cliente no encontrado.' });
      }
      correlativoCliente = buildClientCorrelativo(clientRes.rows[0].code, clientRes.rows[0].seq);
    }

    const detalle = b.detalle.filter(Boolean);
    const impuestos = Number(b.impuestos) || 0;
    const insertRes = await client.query(
      `INSERT INTO quotations
        (correlativo_general, correlativo_cliente, fecha, validez_dias, client_id, cliente_nombre_libre,
         pais, linea_servicio, executive_id, proyecto, descripcion, detalle, monto, impuestos, moneda,
         estatus, version)
       VALUES ($1,$2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Enviada', 1)
       RETURNING *`,
      [correlativoGeneral, correlativoCliente, b.validezDias || 30, b.clientId || null, b.clienteNombreLibre || null,
       b.pais, b.lineaServicio, b.executiveId, b.proyecto.trim(), b.descripcion || '', JSON.stringify(detalle),
       monto, impuestos, b.moneda || 'GTQ']
    );
    const quotation = insertRes.rows[0];
    await client.query('UPDATE quotations SET root_id = id WHERE id = $1', [quotation.id]);
    await client.query('COMMIT');
    quotation.root_id = quotation.id;
    res.status(201).json(quotation);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { estatus, fechaAprobacion, fechaCierreProyecto, observaciones } = req.body;
    const existing = await pool.query('SELECT * FROM quotations WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Cotización no encontrada.' });
    if (existing.rows[0].estatus === 'Sustituida') {
      return res.status(409).json({ error: 'No se puede modificar una cotización sustituida.' });
    }

    let nextFechaAprobacion = fechaAprobacion !== undefined ? fechaAprobacion : existing.rows[0].fecha_aprobacion;
    if (estatus === 'Aprobada' && !nextFechaAprobacion) {
      nextFechaAprobacion = new Date().toISOString().slice(0, 10);
    }

    const { rows } = await pool.query(
      `UPDATE quotations SET
         estatus = COALESCE($1, estatus),
         fecha_aprobacion = $2,
         fecha_cierre_proyecto = COALESCE($3, fecha_cierre_proyecto),
         observaciones = COALESCE($4, observaciones)
       WHERE id = $5 RETURNING *`,
      [estatus || null, nextFechaAprobacion, fechaCierreProyecto !== undefined ? fechaCierreProyecto : null, observaciones ?? null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/:id/adjust', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const srcRes = await client.query('SELECT * FROM quotations WHERE id = $1', [req.params.id]);
    const src = srcRes.rows[0];
    if (!src) return res.status(404).json({ error: 'Cotización no encontrada.' });
    if (src.estatus === 'Sustituida') {
      return res.status(409).json({ error: 'No se puede ajustar una cotización ya sustituida.' });
    }

    const b = req.body;
    if (!b.proyecto || !b.proyecto.trim()) return res.status(400).json({ error: 'Ingresa el nombre del proyecto.' });
    if (!Array.isArray(b.detalle) || !b.detalle.filter(Boolean).length) return res.status(400).json({ error: 'Agrega al menos una línea de detalle.' });
    const monto = Number(b.monto);
    if (!monto || monto <= 0) return res.status(400).json({ error: 'Ingresa un monto válido.' });

    await client.query('BEGIN');
    const version = (src.version || 1) + 1;
    const correlativoGeneral = withVersionSuffix(src.correlativo_general, version);
    const correlativoCliente = src.correlativo_cliente ? withVersionSuffix(src.correlativo_cliente, version) : null;
    const detalle = b.detalle.filter(Boolean);
    const impuestos = Number(b.impuestos) || 0;

    const insertRes = await client.query(
      `INSERT INTO quotations
        (correlativo_general, correlativo_cliente, fecha, validez_dias, client_id, cliente_nombre_libre,
         pais, linea_servicio, executive_id, proyecto, descripcion, detalle, monto, impuestos, moneda,
         estatus, version, previous_version_id, root_id)
       VALUES ($1,$2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Enviada', $15, $16, $17)
       RETURNING *`,
      [correlativoGeneral, correlativoCliente, b.validezDias || src.validez_dias, b.clientId || src.client_id,
       b.clienteNombreLibre || src.cliente_nombre_libre, b.pais || src.pais, b.lineaServicio || src.linea_servicio,
       b.executiveId || src.executive_id, b.proyecto.trim(), b.descripcion || '', JSON.stringify(detalle), monto,
       impuestos, b.moneda || src.moneda, version, src.id, src.root_id || src.id]
    );
    const newQuotation = insertRes.rows[0];
    await client.query('UPDATE quotations SET estatus = $1, superseded_by = $2 WHERE id = $3', ['Sustituida', newQuotation.id, src.id]);
    await client.query('COMMIT');
    res.status(201).json(newQuotation);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
