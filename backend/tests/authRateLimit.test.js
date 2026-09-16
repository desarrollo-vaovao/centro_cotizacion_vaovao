import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, loginAgent } from './helpers/index.js';

// NOTE: the /auth/login and /auth/change-password limiters are separate
// instances, but /auth/login itself is shared module-level state across
// every test in this file (the router is created once, on import). The
// change-password describe block below logs in once via loginAgent before
// the "login rate limiting" block below deliberately exhausts the /login
// limiter, so it must run first to keep its own login call unblocked.
describe('change-password rate limiting', () => {
  beforeEach(async () => {
    process.env.LOGIN_RATE_LIMIT = '2';
    await resetDb();
    await seedTestUser();
  });

  it('blocks after exceeding the configured attempt limit', async () => {
    const agent = makeAgent();
    const csrfToken = await loginAgent(agent);
    await agent.post('/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'wrong', newPassword: 'NewSecret456!' });
    await agent.post('/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'wrong', newPassword: 'NewSecret456!' });
    const third = await agent.post('/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'wrong', newPassword: 'NewSecret456!' });
    expect(third.status).toBe(429);
  });
});

describe('login rate limiting', () => {
  beforeEach(async () => {
    process.env.LOGIN_RATE_LIMIT = '2';
    await resetDb();
    await seedTestUser();
  });

  it('blocks after exceeding the configured attempt limit', async () => {
    const agent = makeAgent();
    await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'wrong' });
    await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'wrong' });
    const third = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'wrong' });
    expect(third.status).toBe(429);
  });
});
