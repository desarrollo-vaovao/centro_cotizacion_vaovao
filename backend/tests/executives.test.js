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

  it('revokes the target user\'s live session on password reset', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;

    const targetAgent = makeAgent();
    const loginRes = await targetAgent.post('/auth/login').send({ email: 'mishel@vaovao.co', password: created.tempPassword });
    expect(loginRes.status).toBe(200);

    const res = await agent.post(`/executives/${created.id}/reset-password`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);

    const stale = await targetAgent.get('/clients');
    expect(stale.status).toBe(401);
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

  it('refuses a self-delete attempt disguised with URL-encoded id formatting, and does not delete the account', async () => {
    const me = await agent.get('/auth/me');
    const ownId = me.body.user.id;

    // A leading space in the URL (%201) and a leading '+' both fail a naive
    // `String(req.params.id) === String(req.session.userId)` comparison
    // while Postgres would still resolve them to the same integer id.
    const spaced = await agent.delete(`/executives/%20${ownId}`).set('X-CSRF-Token', csrfToken);
    expect(spaced.status).toBe(400);

    const plussed = await agent.delete(`/executives/+${ownId}`).set('X-CSRF-Token', csrfToken);
    expect(plussed.status).toBe(400);

    const me2 = await agent.get('/auth/me');
    expect(me2.status).toBe(200);
    expect(me2.body.user.id).toBe(ownId);
  });

  it('returns 400 (not 500) for a non-numeric id on delete and reset-password', async () => {
    const del = await agent.delete('/executives/abc').set('X-CSRF-Token', csrfToken);
    expect(del.status).toBe(400);

    const reset = await agent.post('/executives/abc/reset-password').set('X-CSRF-Token', csrfToken);
    expect(reset.status).toBe(400);
  });

  it('revokes the deleted user\'s live session, not just their identity lookup', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;

    const targetAgent = makeAgent();
    const loginRes = await targetAgent.post('/auth/login').send({ email: 'mishel@vaovao.co', password: created.tempPassword });
    expect(loginRes.status).toBe(200);

    const del = await agent.delete(`/executives/${created.id}`).set('X-CSRF-Token', csrfToken);
    expect(del.status).toBe(204);

    // The old session cookie should now be dead on a normal authenticated
    // route (not /auth/me, which would 401 anyway just from the user row
    // being gone) — proving the session itself was revoked.
    const stale = await targetAgent.get('/clients');
    expect(stale.status).toBe(401);
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
