import { describe, it, expect } from 'vitest';
import { makeAgent } from './helpers/index.js';

describe('security hardening', () => {
  it('never reflects an untrusted Origin back in the CORS header', async () => {
    const res = await makeAgent()
      .options('/clients')
      .set('Origin', 'http://evil.example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
  });

  it('sets baseline security headers via helmet', async () => {
    const res = await makeAgent().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('blocks every protected resource without a session', async () => {
    const agent = makeAgent();
    for (const path of ['/clients', '/executives', '/service-lines', '/quotations', '/dashboard', '/settings/logos']) {
      const res = await agent.get(path);
      expect(res.status).toBe(401);
    }
  });
});
