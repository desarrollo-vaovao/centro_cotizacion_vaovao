import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser } from './helpers/index.js';

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
    await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    await agent.post('/auth/logout');
    const res = await agent.get('/auth/me');
    expect(res.status).toBe(401);
  });
});
