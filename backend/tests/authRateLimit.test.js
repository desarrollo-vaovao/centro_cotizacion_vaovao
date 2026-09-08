import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { resetDb, seedTestUser } from './helpers/index.js';

let createApp;

beforeAll(async () => {
  process.env.LOGIN_RATE_LIMIT = '2';
  // `resetDb`/`seedTestUser` above already pulled in `../src/app.js` (via
  // helpers/index.js's static `import { createApp }`), which caches an
  // already-evaluated module with the default rate limit before this file's
  // own top-level code runs. vi.resetModules() clears that cache so the
  // dynamic import below re-evaluates src/app.js (and routes/auth.js's
  // createLoginLimiter() call) after LOGIN_RATE_LIMIT is set, which is what
  // actually gives us the low-limit app this test needs.
  vi.resetModules();
  ({ createApp } = await import('../src/app.js'));
});

describe('login rate limiting', () => {
  it('blocks after exceeding the configured attempt limit', async () => {
    await resetDb();
    await seedTestUser();
    const agent = request.agent(createApp());
    await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'wrong' });
    await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'wrong' });
    const third = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'wrong' });
    expect(third.status).toBe(429);
  });
});
