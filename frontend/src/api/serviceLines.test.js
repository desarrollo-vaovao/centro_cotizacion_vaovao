import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useServiceLines } from './serviceLines.js';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useServiceLines', () => {
  it('maps sort_order to sortOrder', async () => {
    api.get.mockResolvedValue([{ id: 1, name: 'Video', sort_order: 0 }]);
    const { result } = renderHook(() => useServiceLines(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data[0]).toEqual({ id: 1, name: 'Video', sortOrder: 0 });
  });
});
