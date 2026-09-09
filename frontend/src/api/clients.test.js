import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useClients, useCreateClient } from './clients.js';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useClients', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('maps snake_case fields to camelCase', async () => {
    api.get.mockResolvedValue([
      { id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: 'Ana', contact_email: null, contact_phone: null, seq: 2 }
    ]);
    const { result } = renderHook(() => useClients(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data[0]).toEqual({
      id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contactName: 'Ana', contactEmail: null, contactPhone: null, seq: 2
    });
  });
});

describe('useCreateClient', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('posts camelCase fields to /clients', async () => {
    api.post.mockResolvedValue({ id: 2, code: 'TIENDA', name: 'Tienda', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 0 });
    const { result } = renderHook(() => useCreateClient(), { wrapper });
    await result.current.mutateAsync({ name: 'Tienda', country: 'Guatemala' });
    expect(api.post).toHaveBeenCalledWith('/clients', { name: 'Tienda', country: 'Guatemala' });
  });
});
