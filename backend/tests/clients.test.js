import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, loginAgent } from './helpers/index.js';

describe('clients', () => {
  let agent, csrfToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
    agent = makeAgent();
    csrfToken = await loginAgent(agent);
  });

  it('rejects requests without a session', async () => {
    const res = await makeAgent().get('/clients');
    expect(res.status).toBe(401);
  });

  it('rejects mutating requests without a csrf token', async () => {
    const res = await agent.post('/clients').send({ name: 'Tengo Tienda', country: 'Guatemala' });
    expect(res.status).toBe(403);
  });

  it('creates a client with an auto-generated code', async () => {
    const res = await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Tengo Tienda', country: 'Guatemala' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('TENGO');
  });

  it('rejects a duplicate client code', async () => {
    await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Tengo Tienda', country: 'Guatemala', code: 'TIENDA' });
    const res = await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Otra Tienda', country: 'Guatemala', code: 'TIENDA' });
    expect(res.status).toBe(409);
  });

  it('lists clients ordered by name', async () => {
    await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Zeta SA', country: 'Guatemala' });
    await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Alfa SA', country: 'Guatemala' });
    const res = await agent.get('/clients');
    expect(res.body.map((c) => c.name)).toEqual(['Alfa SA', 'Zeta SA']);
  });

  it('updates a client', async () => {
    const created = await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Tengo Tienda', country: 'Guatemala' });
    const res = await agent.patch(`/clients/${created.body.id}`).set('X-CSRF-Token', csrfToken).send({ contactName: 'Ana' });
    expect(res.status).toBe(200);
    expect(res.body.contact_name).toBe('Ana');
  });

  it('does not clear contact fields with empty string', async () => {
    const created = await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Tengo Tienda', country: 'Guatemala', contactEmail: 'original@example.com' });
    const res = await agent.patch(`/clients/${created.body.id}`).set('X-CSRF-Token', csrfToken).send({ contactEmail: '' });
    expect(res.status).toBe(200);
    expect(res.body.contact_email).toBe('original@example.com');
  });

  it('deletes a client', async () => {
    const created = await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Tengo Tienda', country: 'Guatemala' });
    const res = await agent.delete(`/clients/${created.body.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(204);
    const list = await agent.get('/clients');
    expect(list.body.map((c) => c.id)).not.toContain(created.body.id);
  });

  it('returns 404 when deleting a client that does not exist', async () => {
    const res = await agent.delete('/clients/999999').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(404);
  });

  it('refuses to delete a client that has quotations', async () => {
    const client = await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Tengo Tienda', country: 'Guatemala' });
    const exec = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Marco Ramírez' });
    await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send({
      clientId: client.body.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.body.id,
      proyecto: 'Contenidos', detalle: ['Edición de 6 videos'], monto: 100
    });
    const res = await agent.delete(`/clients/${client.body.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(409);
  });
});
