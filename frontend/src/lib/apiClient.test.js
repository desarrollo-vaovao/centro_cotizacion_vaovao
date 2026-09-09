import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './apiClient.js';
import { setCsrfToken } from './csrfToken.js';

function mockFetchOnce(status, body) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  });
}

describe('apiClient', () => {
  afterEach(() => { vi.restoreAllMocks(); setCsrfToken(null); });

  it('sends credentials and parses a successful JSON response', async () => {
    mockFetchOnce(200, { ok: true });
    const data = await api.get('/health');
    expect(data).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({ credentials: 'include', method: 'GET' })
    );
  });

  it('attaches the CSRF token header on a mutating request', async () => {
    setCsrfToken('tok123');
    mockFetchOnce(201, { id: 1 });
    await api.post('/clients', { name: 'X' });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['X-CSRF-Token']).toBe('tok123');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ name: 'X' });
  });

  it('does not attach a CSRF header on a GET request', async () => {
    setCsrfToken('tok123');
    mockFetchOnce(200, []);
    await api.get('/clients');
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['X-CSRF-Token']).toBeUndefined();
  });

  it('throws an error carrying the status and backend error message', async () => {
    mockFetchOnce(409, { error: 'Ese código de cliente ya existe.' });
    await expect(api.post('/clients', {})).rejects.toMatchObject({
      status: 409,
      message: 'Ese código de cliente ya existe.'
    });
  });
});
