import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, loginAgent } from './helpers/index.js';

describe('settings/logos', () => {
  let agent, csrfToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
    agent = makeAgent();
    csrfToken = await loginAgent(agent);
  });

  it('starts with no logos set', async () => {
    const res = await agent.get('/settings/logos');
    expect(res.body.logo_agencia).toBeNull();
    expect(res.body.logo_velarc).toBeNull();
  });

  it('saves a logo', async () => {
    const res = await agent.put('/settings/logos').set('X-CSRF-Token', csrfToken).send({ logoAgencia: 'data:image/png;base64,AAAA' });
    expect(res.status).toBe(200);
    expect(res.body.logo_agencia).toBe('data:image/png;base64,AAAA');
  });

  it('rejects a logo over 1.5MB', async () => {
    const big = 'A'.repeat(Math.ceil(1.6 * 1024 * 1024));
    const res = await agent.put('/settings/logos').set('X-CSRF-Token', csrfToken).send({ logoAgencia: big });
    expect(res.status).toBe(400);
  });

  it('clears a logo', async () => {
    await agent.put('/settings/logos').set('X-CSRF-Token', csrfToken).send({ logoAgencia: 'data:image/png;base64,AAAA' });
    const res = await agent.delete('/settings/logos/agencia').set('X-CSRF-Token', csrfToken);
    expect(res.body.logo_agencia).toBeNull();
  });
});
