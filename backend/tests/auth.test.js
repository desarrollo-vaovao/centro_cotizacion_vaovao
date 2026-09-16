import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, seedTestExecutive, loginAgent } from './helpers/index.js';
import { pool } from '../src/db.js';

describe('auth', () => {
  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
  });

  it('logs in with correct credentials and returns a csrf token', async () => {
    const agent = makeAgent();
    const res = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@vaovao.co');
    expect(res.body.csrfToken).toBeTruthy();
    expect(res.headers['set-cookie'][0]).toMatch(/vv_sid=/);
  });

  it('rejects a wrong password', async () => {
    const agent = makeAgent();
    const res = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 from /auth/me without a session', async () => {
    const res = await makeAgent().get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user from /auth/me with a session', async () => {
    const agent = makeAgent();
    await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    const res = await agent.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@vaovao.co');
  });

  it('clears the session on logout', async () => {
    const agent = makeAgent();
    const loginRes = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    await agent.post('/auth/logout').set('X-CSRF-Token', loginRes.body.csrfToken);
    const res = await agent.get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('reports mustChangePassword=false for a normal account on login', async () => {
    const agent = makeAgent();
    const res = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    expect(res.body.user.mustChangePassword).toBe(false);
  });

  it('reports mustChangePassword=true on login and /auth/me for a flagged account', async () => {
    await pool.query(`UPDATE users SET must_change_password = true WHERE email = 'test@vaovao.co'`);
    const agent = makeAgent();
    const loginRes = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    expect(loginRes.body.user.mustChangePassword).toBe(true);

    const meRes = await agent.get('/auth/me');
    expect(meRes.body.user.mustChangePassword).toBe(true);
  });

  it('reports role=owner on login and /auth/me for the seeded test account', async () => {
    const agent = makeAgent();
    const loginRes = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    expect(loginRes.body.user.role).toBe('owner');
    const meRes = await agent.get('/auth/me');
    expect(meRes.body.user.role).toBe('owner');
  });

  it('reports role=executive for a non-owner account', async () => {
    await seedTestExecutive();
    const agent = makeAgent();
    const res = await agent.post('/auth/login').send({ email: 'exec@vaovao.co', password: 'Test1234!' });
    expect(res.body.user.role).toBe('executive');
  });
});

describe('POST /auth/change-password', () => {
  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
  });

  it('changes the password, clears must_change_password, and the old password stops working', async () => {
    await pool.query(`UPDATE users SET must_change_password = true WHERE email = 'test@vaovao.co'`);
    const agent = makeAgent();
    const csrfToken = await loginAgent(agent);

    const res = await agent.post('/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'Test1234!', newPassword: 'NewSecret456!' });
    expect(res.status).toBe(200);

    const meRes = await agent.get('/auth/me');
    expect(meRes.body.user.mustChangePassword).toBe(false);

    const oldLogin = await makeAgent().post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await makeAgent().post('/auth/login').send({ email: 'test@vaovao.co', password: 'NewSecret456!' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an incorrect current password', async () => {
    const agent = makeAgent();
    const csrfToken = await loginAgent(agent);
    const res = await agent.post('/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'wrong', newPassword: 'NewSecret456!' });
    expect(res.status).toBe(401);
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const agent = makeAgent();
    const csrfToken = await loginAgent(agent);
    const res = await agent.post('/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'Test1234!', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('requires an authenticated session', async () => {
    const res = await makeAgent().post('/auth/change-password').send({ currentPassword: 'x', newPassword: 'NewSecret456!' });
    expect(res.status).toBe(401);
  });

  it('requires a valid CSRF token', async () => {
    const agent = makeAgent();
    await loginAgent(agent);
    const res = await agent.post('/auth/change-password').send({ currentPassword: 'Test1234!', newPassword: 'NewSecret456!' });
    expect(res.status).toBe(403);
  });
});
