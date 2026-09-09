import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();
const PERIODS = ['mes', 'trimestre', 'semestre', 'año', 'todo'];

function periodRange(period) {
  const now = new Date();
  const y = now.getFullYear();
  if (period === 'todo') return [null, null];
  if (period === 'mes') return [new Date(y, now.getMonth(), 1), new Date(y, now.getMonth() + 1, 1)];
  if (period === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3);
    return [new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 1)];
  }
  if (period === 'semestre') {
    const h = Math.floor(now.getMonth() / 6);
    return [new Date(y, h * 6, 1), new Date(y, h * 6 + 6, 1)];
  }
  return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
}

function toISO(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchPeriodQuotations(period, extraWhere = '', extraParams = []) {
  const [start, end] = periodRange(period);
  const params = [toISO(start), toISO(end), ...extraParams];
  const { rows } = await pool.query(
    `SELECT * FROM quotations
     WHERE estatus != 'Sustituida'
       AND ($1::date IS NULL OR fecha >= $1)
       AND ($2::date IS NULL OR fecha < $2)
       ${extraWhere}
     ORDER BY fecha`,
    params
  );
  return rows;
}

function money(q) { return Number(q.monto) + Number(q.impuestos); }

function avgDays(rows, f1, f2) {
  const vals = rows
    .map((q) => (q[f1] && q[f2]) ? Math.round((new Date(q[f2]) - new Date(q[f1])) / 86400000) : null)
    .filter((v) => v !== null && v >= 0);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function buildKpis(rows) {
  const montoPeriodo = rows.reduce((a, q) => a + money(q), 0);
  const montoAprobado = rows.filter((q) => q.estatus === 'Aprobada').reduce((a, q) => a + money(q), 0);
  const montoPerdido = rows.filter((q) => q.estatus === 'Denegada').reduce((a, q) => a + money(q), 0);
  const decided = rows.filter((q) => q.estatus === 'Aprobada' || q.estatus === 'Denegada');
  const tasa = decided.length ? Math.round(decided.filter((q) => q.estatus === 'Aprobada').length / decided.length * 100) : null;
  return {
    montoPeriodo, montoAprobado, montoPerdido,
    avgAprob: avgDays(rows, 'fecha', 'fecha_aprobacion'),
    avgCierre: avgDays(rows, 'fecha_aprobacion', 'fecha_cierre_proyecto'),
    tasa
  };
}

function topBy(rows, keyFn, limit) {
  const byKey = {};
  rows.forEach((q) => { const k = keyFn(q); byKey[k] = (byKey[k] || 0) + money(q); });
  return Object.entries(byKey).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function byClientRows(rows, clientNames, limit) {
  const byClient = {};
  rows.forEach((q) => {
    const name = clientNames[q.client_id] || q.cliente_nombre_libre || '—';
    if (!byClient[name]) byClient[name] = { count: 0, monto: 0 };
    byClient[name].count++;
    byClient[name].monto += money(q);
  });
  return Object.entries(byClient).sort((a, b) => b[1].monto - a[1].monto).slice(0, limit);
}

function byExecRows(rows, execNames) {
  const byExec = {};
  rows.forEach((q) => {
    const name = execNames[q.executive_id] || '—';
    if (!byExec[name]) byExec[name] = { count: 0, monto: 0 };
    byExec[name].count++;
    byExec[name].monto += money(q);
  });
  return Object.entries(byExec).sort((a, b) => b[1].monto - a[1].monto);
}

router.get('/', async (req, res, next) => {
  try {
    const period = PERIODS.includes(req.query.period) ? req.query.period : 'mes';
    const rows = await fetchPeriodQuotations(period);

    const [clientsRes, execRes] = await Promise.all([
      pool.query('SELECT id, name FROM clients'),
      pool.query('SELECT id, name FROM executives')
    ]);
    const clientNames = Object.fromEntries(clientsRes.rows.map((c) => [c.id, c.name]));
    const execNames = Object.fromEntries(execRes.rows.map((e) => [e.id, e.name]));

    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const allActive = await pool.query(`SELECT fecha, monto, impuestos, estatus FROM quotations WHERE estatus != 'Sustituida'`);
    const tendencia = months.map((m) => {
      const inMonth = allActive.rows.filter((q) => q.fecha && q.fecha.slice(0, 7) === m);
      return {
        month: m,
        aprobado: inMonth.filter((q) => q.estatus === 'Aprobada').reduce((a, q) => a + money(q), 0),
        enProceso: inMonth.filter((q) => q.estatus === 'Enviada' || q.estatus === 'En Proceso - Cliente').reduce((a, q) => a + money(q), 0),
        denegado: inMonth.filter((q) => q.estatus === 'Denegada').reduce((a, q) => a + money(q), 0)
      };
    });

    res.json({
      period,
      kpis: buildKpis(rows),
      lineas: topBy(rows, (q) => q.linea_servicio, 8),
      clientes: byClientRows(rows, clientNames, 8),
      ejecutivos: byExecRows(rows, execNames),
      tendencia
    });
  } catch (err) { next(err); }
});

router.get('/cliente/:clientId', async (req, res, next) => {
  try {
    const period = PERIODS.includes(req.query.period) ? req.query.period : 'mes';
    const rows = await fetchPeriodQuotations(period, 'AND client_id = $3', [req.params.clientId]);
    res.json({ period, count: rows.length, kpis: buildKpis(rows), lineas: topBy(rows, (q) => q.linea_servicio, 100) });
  } catch (err) { next(err); }
});

export default router;
