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
});
