import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, loginAgent } from './helpers/index.js';
import { pool } from '../src/db.js';

async function insertQuotation({ clientId, executiveId, fecha, estatus, monto, impuestos, lineaServicio }) {
  const { rows } = await pool.query(
    `INSERT INTO quotations (correlativo_general, fecha, validez_dias, client_id, pais, linea_servicio,
       executive_id, proyecto, detalle, monto, impuestos, moneda, estatus, version)
     VALUES ('PC-TEST-'||floor(random()*100000), $1, 30, $2, 'Guatemala', $3, $4, 'Proyecto test', '["x"]', $5, $6, 'GTQ', $7, 1)
     RETURNING id`,
    [fecha, clientId, lineaServicio, executiveId, monto, impuestos, estatus]
  );
  await pool.query('UPDATE quotations SET root_id = id WHERE id = $1', [rows[0].id]);
}

describe('dashboard', () => {
  let agent, csrfToken, client, exec;

  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
    agent = makeAgent();
    csrfToken = await loginAgent(agent);
    client = (await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'C807', country: 'Guatemala', code: 'C807' })).body;
    exec = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Marco' })).body;
  });

  it('computes kpis for the current period', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: today, estatus: 'Aprobada', monto: 1000, impuestos: 120, lineaServicio: 'Video' });
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: today, estatus: 'Denegada', monto: 500, impuestos: 60, lineaServicio: 'Diseño' });

    const res = await agent.get('/dashboard').query({ period: 'mes' });
    expect(res.status).toBe(200);
    expect(res.body.kpis.montoPeriodo).toBe(1680);
    expect(res.body.kpis.montoAprobado).toBe(1120);
    expect(res.body.kpis.montoPerdido).toBe(560);
    expect(res.body.kpis.tasa).toBe(50);
  });

  it('excludes sustituida quotations from the totals', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: today, estatus: 'Sustituida', monto: 5000, impuestos: 600, lineaServicio: 'Video' });
    const res = await agent.get('/dashboard').query({ period: 'todo' });
    expect(res.body.kpis.montoPeriodo).toBe(0);
  });

  it('returns per-client detail', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: today, estatus: 'Aprobada', monto: 1000, impuestos: 0, lineaServicio: 'Video' });
    const res = await agent.get(`/dashboard/cliente/${client.id}`).query({ period: 'todo' });
    expect(res.body.count).toBe(1);
    expect(res.body.kpis.montoAprobado).toBe(1000);
  });

  it('defaults the trend to 6 monthly buckets, with today\'s quotation in the last one', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: today, estatus: 'Aprobada', monto: 1000, impuestos: 0, lineaServicio: 'Video' });
    const res = await agent.get('/dashboard').query({ period: 'todo' });
    expect(res.body.tendencia).toHaveLength(6);
    expect(res.body.tendencia.at(-1).aprobado).toBe(1000);
    expect(res.body.tendencia.slice(0, 5).every((b) => b.aprobado === 0)).toBe(true);
  });

  it('follows the period into weekly trend buckets when period=semana', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: today, estatus: 'Denegada', monto: 500, impuestos: 0, lineaServicio: 'Video' });
    const res = await agent.get('/dashboard').query({ period: 'semana' });
    expect(res.body.tendencia).toHaveLength(8);
    expect(res.body.tendencia.at(-1).denegado).toBe(500);
  });

  it('follows the period into quarterly trend buckets when period=trimestre', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: today, estatus: 'Enviada', monto: 200, impuestos: 0, lineaServicio: 'Video' });
    const res = await agent.get('/dashboard').query({ period: 'trimestre' });
    expect(res.body.tendencia).toHaveLength(6);
    expect(res.body.tendencia.at(-1).enProceso).toBe(200);
  });

  it('falls back to monthly trend buckets for periods with no matching granularity', async () => {
    const resSemestre = await agent.get('/dashboard').query({ period: 'semestre' });
    expect(resSemestre.body.tendencia).toHaveLength(6);
    const resAnio = await agent.get('/dashboard').query({ period: 'año' });
    expect(resAnio.body.tendencia).toHaveLength(6);
  });

  it('anchors the trend window to refDate, not just today', async () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const lastMonthIso = lastMonth.toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: lastMonthIso, estatus: 'Aprobada', monto: 700, impuestos: 0, lineaServicio: 'Video' });

    const res = await agent.get('/dashboard').query({ period: 'mes', refDate: lastMonthIso });
    expect(res.body.tendencia.at(-1).aprobado).toBe(700);
  });

  it('lets refDate pick which month to view, excluding it from the default (today-anchored) month', async () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const lastMonthIso = lastMonth.toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: lastMonthIso, estatus: 'Aprobada', monto: 900, impuestos: 0, lineaServicio: 'Video' });

    const defaultRes = await agent.get('/dashboard').query({ period: 'mes' });
    expect(defaultRes.body.kpis.montoAprobado).toBe(0);

    const pickedRes = await agent.get('/dashboard').query({ period: 'mes', refDate: lastMonthIso });
    expect(pickedRes.body.kpis.montoAprobado).toBe(900);
  });

  it('supports period=semana, anchored to refDate', async () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const refDate = twoWeeksAgo.toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: refDate, estatus: 'Aprobada', monto: 300, impuestos: 0, lineaServicio: 'Video' });

    const thisWeekRes = await agent.get('/dashboard').query({ period: 'semana' });
    expect(thisWeekRes.body.kpis.montoAprobado).toBe(0);

    const pickedWeekRes = await agent.get('/dashboard').query({ period: 'semana', refDate });
    expect(pickedWeekRes.body.kpis.montoAprobado).toBe(300);
  });

  it('ignores a malformed refDate and falls back to today', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await insertQuotation({ clientId: client.id, executiveId: exec.id, fecha: today, estatus: 'Aprobada', monto: 400, impuestos: 0, lineaServicio: 'Video' });
    const res = await agent.get('/dashboard').query({ period: 'mes', refDate: 'not-a-date' });
    expect(res.body.kpis.montoAprobado).toBe(400);
  });
});
