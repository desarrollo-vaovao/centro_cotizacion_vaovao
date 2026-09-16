import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser } from './helpers/index.js';
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
});
