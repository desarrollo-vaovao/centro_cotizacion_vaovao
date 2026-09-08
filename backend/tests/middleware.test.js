import { describe, it, expect, vi } from 'vitest';
import { requireAuth } from '../src/middleware/auth.js';
import { verifyCsrf } from '../src/middleware/csrf.js';

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('requireAuth', () => {
  it('calls next() when there is a session with a userId', () => {
    const next = vi.fn();
    requireAuth({ session: { userId: 1 } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('responds 401 when there is no session', () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth({ session: null }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('verifyCsrf', () => {
  it('skips GET requests', () => {
    const next = vi.fn();
    verifyCsrf({ method: 'GET', session: {}, header: () => null }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('allows a POST request whose header token matches the session token', () => {
    const next = vi.fn();
    const req = { method: 'POST', session: { csrfToken: 'abc' }, header: () => 'abc' };
    verifyCsrf(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects a POST request with a missing or mismatched token', () => {
    const res = mockRes();
    const next = vi.fn();
    const req = { method: 'POST', session: { csrfToken: 'abc' }, header: () => 'wrong' };
    verifyCsrf(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
