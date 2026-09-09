import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useClientDashboard } from './dashboard.js';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn() } }));

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useClientDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fetches the per-client dashboard endpoint with the period param', async () => {
    api.get.mockResolvedValue({ period: 'mes', count: 1, kpis: {}, lineas: [] });
    const { result } = renderHook(() => useClientDashboard(1, 'mes'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/dashboard/cliente/1?period=mes');
  });

  it('does not fetch when clientId is empty', () => {
    const { result } = renderHook(() => useClientDashboard('', 'mes'), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });
});
