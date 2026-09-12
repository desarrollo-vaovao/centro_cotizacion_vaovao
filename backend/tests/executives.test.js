import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, loginAgent } from './helpers/index.js';

describe('executives', () => {
  let agent, csrfToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
    agent = makeAgent();
    csrfToken = await loginAgent(agent);
  });

  it('rejects an executive without a name', async () => {
    const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({});
    expect(res.status).toBe(400);
  });

  it('creates and lists executives ordered by name', async () => {
    await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez' });
    await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Marco Ramírez' });
    const res = await agent.get('/executives');
    expect(res.body.map((e) => e.name)).toEqual(['Marco Ramírez', 'Mishel Velez']);
  });

  it('deletes an executive', async () => {
    const created = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez' });
    const res = await agent.delete(`/executives/${created.body.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(204);
    const list = await agent.get('/executives');
    expect(list.body.map((e) => e.id)).not.toContain(created.body.id);
  });

  it('returns 404 when deleting an executive that does not exist', async () => {
    const res = await agent.delete('/executives/999999').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(404);
  });

  it('refuses to delete an executive that has quotations', async () => {
    const client = await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Tengo Tienda', country: 'Guatemala' });
    const exec = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez' });
    await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send({
      clientId: client.body.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.body.id,
      proyecto: 'Contenidos', detalle: ['Edición de 6 videos'], monto: 100
    });
    const res = await agent.delete(`/executives/${exec.body.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(409);
  });
});
