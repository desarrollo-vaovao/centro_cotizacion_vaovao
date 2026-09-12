import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();
const PERIODS = ['semana', 'mes', 'trimestre', 'semestre', 'año', 'todo'];
// The trend chart has no filter of its own — it follows whatever period the
// user picked up top. semestre/año/todo have no matching trend granularity,
// so they fall back to monthly buckets (the most useful default span).
const TREND_GRANULARITY_BY_PERIOD = { semana: 'semana', mes: 'mes', trimestre: 'trimestre' };

function toISO(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (d.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

// req.query.refDate lets the client pick *which* week/month/quarter/etc to
// look at, instead of the period always being anchored to today.
function parseRefDate(raw) {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function periodRange(period, refDate = new Date()) {
  const y = refDate.getFullYear();
  if (period === 'todo') return [null, null];
  if (period === 'semana') {
    const start = startOfWeek(refDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return [start, end];
  }
  if (period === 'mes') return [new Date(y, refDate.getMonth(), 1), new Date(y, refDate.getMonth() + 1, 1)];
  if (period === 'trimestre') {
    const q = Math.floor(refDate.getMonth() / 3);
    return [new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 1)];
  }
  if (period === 'semestre') {
    const h = Math.floor(refDate.getMonth() / 6);
    return [new Date(y, h * 6, 1), new Date(y, h * 6 + 6, 1)];
  }
  return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
}

// Builds a fixed number of consecutive [start, end) buckets ending at the
// current period, in the requested granularity — the trend chart's x-axis
// is always "however many of these fit nicely on screen", not a fixed
// calendar window, so week/quarter granularities show a comparable span.
function buildTrendBuckets(granularity, refDate = new Date()) {
  const now = refDate;
  const buckets = [];
  if (granularity === 'semana') {
    const thisWeekStart = startOfWeek(now);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(thisWeekStart);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      buckets.push({ label: toISO(start), start: toISO(start), end: toISO(end) });
    }
  } else if (granularity === 'trimestre') {
    const currentQuarterIndex = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3);
    for (let i = 5; i >= 0; i--) {
      const qIndex = currentQuarterIndex - i;
      const y = Math.floor(qIndex / 4);
      const q = ((qIndex % 4) + 4) % 4;
      const start = new Date(y, q * 3, 1);
      const end = new Date(y, q * 3 + 3, 1);
      buckets.push({ label: `${y}-T${q + 1}`, start: toISO(start), end: toISO(end) });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({ label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`, start: toISO(start), end: toISO(end) });
    }
  }
  return buckets;
}

async function fetchPeriodQuotations(period, refDate, extraWhere = '', extraParams = []) {
  const [start, end] = periodRange(period, refDate);
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
    const refDate = parseRefDate(req.query.refDate);
    const rows = await fetchPeriodQuotations(period, refDate);

    const [clientsRes, execRes] = await Promise.all([
      pool.query('SELECT id, name FROM clients'),
      pool.query('SELECT id, name FROM executives')
    ]);
    const clientNames = Object.fromEntries(clientsRes.rows.map((c) => [c.id, c.name]));
    const execNames = Object.fromEntries(execRes.rows.map((e) => [e.id, e.name]));

    const trendGranularity = TREND_GRANULARITY_BY_PERIOD[period] || 'mes';
    const allActive = await pool.query(`SELECT fecha, monto, impuestos, estatus FROM quotations WHERE estatus != 'Sustituida'`);
    const tendencia = buildTrendBuckets(trendGranularity, refDate).map(({ label, start, end }) => {
      const inBucket = allActive.rows.filter((q) => q.fecha && q.fecha >= start && q.fecha < end);
      return {
        period: label,
        aprobado: inBucket.filter((q) => q.estatus === 'Aprobada').reduce((a, q) => a + money(q), 0),
        enProceso: inBucket.filter((q) => q.estatus === 'Enviada' || q.estatus === 'En Proceso - Cliente').reduce((a, q) => a + money(q), 0),
        denegado: inBucket.filter((q) => q.estatus === 'Denegada').reduce((a, q) => a + money(q), 0)
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
    const refDate = parseRefDate(req.query.refDate);
    const rows = await fetchPeriodQuotations(period, refDate, 'AND client_id = $3', [req.params.clientId]);
    res.json({ period, count: rows.length, kpis: buildKpis(rows), lineas: topBy(rows, (q) => q.linea_servicio, 100) });
  } catch (err) { next(err); }
});

export default router;
