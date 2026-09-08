import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, loginAgent } from './helpers/index.js';

describe('service lines', () => {
  let agent, csrfToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
    agent = makeAgent();
    csrfToken = await loginAgent(agent);
  });

  it('creates service lines in increasing sort order', async () => {
    const first = await agent.post('/service-lines').set('X-CSRF-Token', csrfToken).send({ name: 'Video' });
    const second = await agent.post('/service-lines').set('X-CSRF-Token', csrfToken).send({ name: 'Diseño' });
    expect(first.body.sort_order).toBe(0);
    expect(second.body.sort_order).toBe(1);
  });

  it('renames a service line', async () => {
    const created = await agent.post('/service-lines').set('X-CSRF-Token', csrfToken).send({ name: 'Video' });
    const res = await agent.patch(`/service-lines/${created.body.id}`).set('X-CSRF-Token', csrfToken).send({ name: 'Video y animación' });
    expect(res.body.name).toBe('Video y animación');
  });

  it('deletes a service line', async () => {
    const created = await agent.post('/service-lines').set('X-CSRF-Token', csrfToken).send({ name: 'Video' });
    const res = await agent.delete(`/service-lines/${created.body.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(204);
    const list = await agent.get('/service-lines');
    expect(list.body).toHaveLength(0);
  });

  it('returns 404 when deleting a service line that does not exist', async () => {
    const res = await agent.delete('/service-lines/9999').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(404);
  });
});
