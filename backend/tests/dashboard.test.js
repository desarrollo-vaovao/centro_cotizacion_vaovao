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
});
