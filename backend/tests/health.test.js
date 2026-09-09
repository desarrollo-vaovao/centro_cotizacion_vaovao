import { describe, it, expect } from 'vitest';
import { makeAgent } from './helpers/index.js';

describe('health check', () => {
  it('responds ok on GET /health', async () => {
    const res = await makeAgent().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 404 for an unknown route', async () => {
    const res = await makeAgent().get('/nope');
    expect(res.status).toBe(404);
  });
});
