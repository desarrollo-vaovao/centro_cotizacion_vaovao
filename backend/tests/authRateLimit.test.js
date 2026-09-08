import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser } from './helpers/index.js';

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
