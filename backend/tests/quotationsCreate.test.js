import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, loginAgent } from './helpers/index.js';

async function createClient(agent, csrfToken, overrides = {}) {
  const res = await agent.post('/clients').set('X-CSRF-Token', csrfToken)
    .send({ name: 'C807 Operador', country: 'Guatemala', code: 'C807', ...overrides });
  return res.body;
}

async function createExecutive(agent, csrfToken) {
  const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Marco Ramírez' });
  return res.body;
}

describe('quotations create/list', () => {
  let agent, csrfToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
    agent = makeAgent();
    csrfToken = await loginAgent(agent);
  });

  it('creates a quotation with generated correlativos', async () => {
    const client = await createClient(agent, csrfToken);
    const exec = await createExecutive(agent, csrfToken);
    const res = await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send({
      clientId: client.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id,
      proyecto: 'Contenidos', detalle: ['Edición de 6 videos'], monto: 3100, impuestos: 372, moneda: 'GTQ', validezDias: 30
    });
    expect(res.status).toBe(201);
    expect(res.body.correlativo_general).toBe(`PC-${new Date().getFullYear()}-001`);
    expect(res.body.correlativo_cliente).toBe('PC-C807-001');
    expect(res.body.estatus).toBe('Enviada');
    expect(res.body.version).toBe(1);
  });

  it('increments the general and client sequences independently', async () => {
    const client = await createClient(agent, csrfToken);
    const exec = await createExecutive(agent, csrfToken);
    const payload = { clientId: client.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id, proyecto: 'P', detalle: ['x'], monto: 100 };
    const first = await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send(payload);
    const second = await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send(payload);
    expect(first.body.correlativo_cliente).toBe('PC-C807-001');
    expect(second.body.correlativo_cliente).toBe('PC-C807-002');
    expect(second.body.correlativo_general).toBe(`PC-${new Date().getFullYear()}-002`);
  });

  it('rejects a quotation without detalle lines', async () => {
    const client = await createClient(agent, csrfToken);
    const exec = await createExecutive(agent, csrfToken);
    const res = await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send({
      clientId: client.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id, proyecto: 'P', detalle: [], monto: 100
    });
    expect(res.status).toBe(400);
  });

  it('filters the list by estatus', async () => {
    const client = await createClient(agent, csrfToken);
    const exec = await createExecutive(agent, csrfToken);
    const payload = { clientId: client.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id, proyecto: 'P', detalle: ['x'], monto: 100 };
    const created = await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send(payload);
    await agent.patch(`/quotations/${created.body.id}`).set('X-CSRF-Token', csrfToken).send({ estatus: 'Aprobada' });
    const res = await agent.get('/quotations').query({ estatus: 'Aprobada' });
    expect(res.body).toHaveLength(1);
  });
});
