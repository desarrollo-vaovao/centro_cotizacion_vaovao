import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, seedTestExecutive, loginAgent } from './helpers/index.js';

describe('executives (users with role)', () => {
  let agent, csrfToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
    agent = makeAgent();
    csrfToken = await loginAgent(agent);
  });

  it('rejects a new user without a name', async () => {
    const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ email: 'a@vaovao.co' });
    expect(res.status).toBe(400);
  });

  it('rejects a new user without an email', async () => {
    const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez' });
    expect(res.status).toBe(400);
  });

  it('creates a user with role=executive, must_change_password=true, and returns a one-time tempPassword', async () => {
    const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken)
      .send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('executive');
    expect(res.body.tempPassword).toHaveLength(12);

    // the returned tempPassword actually logs the new account in, and it is
    // flagged to force a password change on that first login
    const newLogin = await makeAgent().post('/auth/login').send({ email: 'mishel@vaovao.co', password: res.body.tempPassword });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(true);
  });

  it('rejects creating a user with an email already in use', async () => {
    await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' });
    const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Otro Nombre', email: 'mishel@vaovao.co' });
    expect(res.status).toBe(409);
  });

  it('lists users ordered by name, including email and role', async () => {
    await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' });
    const res = await agent.get('/executives');
    const mishel = res.body.find((u) => u.email === 'mishel@vaovao.co');
    expect(mishel.role).toBe('executive');
    expect(mishel.name).toBe('Mishel Velez');
  });

  it('a non-owner cannot create a user', async () => {
    await seedTestExecutive();
    const execAgent = makeAgent();
    const execCsrf = await loginAgent2(execAgent);
    const res = await execAgent.post('/executives').set('X-CSRF-Token', execCsrf).send({ name: 'X', email: 'x@vaovao.co' });
    expect(res.status).toBe(403);
  });

  it('resets a user\'s password and returns a new one-time tempPassword', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    const res = await agent.post(`/executives/${created.id}/reset-password`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toHaveLength(12);
    expect(res.body.tempPassword).not.toBe(created.tempPassword);

    const newLogin = await makeAgent().post('/auth/login').send({ email: 'mishel@vaovao.co', password: res.body.tempPassword });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(true);
  });

  it('a non-owner cannot reset another user\'s password', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    await seedTestExecutive();
    const execAgent = makeAgent();
    const execCsrf = await loginAgent2(execAgent);
    const res = await execAgent.post(`/executives/${created.id}/reset-password`).set('X-CSRF-Token', execCsrf);
    expect(res.status).toBe(403);
  });

  it('deletes a user', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    const res = await agent.delete(`/executives/${created.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(204);
    const list = await agent.get('/executives');
    expect(list.body.map((u) => u.id)).not.toContain(created.id);
  });

  it('returns 404 when deleting a user that does not exist', async () => {
    const res = await agent.delete('/executives/999999').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(404);
  });

  it('refuses to let a user delete their own account', async () => {
    const me = await agent.get('/auth/me');
    const res = await agent.delete(`/executives/${me.body.user.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(400);
  });

  it('a non-owner cannot delete a user', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    await seedTestExecutive();
    const execAgent = makeAgent();
    const execCsrf = await loginAgent2(execAgent);
    const res = await execAgent.delete(`/executives/${created.id}`).set('X-CSRF-Token', execCsrf);
    expect(res.status).toBe(403);
  });

  it('refuses to delete a user that has quotations', async () => {
    const client = await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Tengo Tienda', country: 'Guatemala' });
    const exec = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send({
      clientId: client.body.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id,
      proyecto: 'Contenidos', detalle: ['Edición de 6 videos'], monto: 100
    });
    const res = await agent.delete(`/executives/${exec.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(409);
  });
});

// exec@vaovao.co's password is the same fixed test password seedTestUser
// uses — this local helper avoids re-exporting a second loginAgent variant
// from helpers/index.js just for one different email.
async function loginAgent2(agent) {
  const res = await agent.post('/auth/login').send({ email: 'exec@vaovao.co', password: 'Test1234!' });
  return res.body.csrfToken;
}
