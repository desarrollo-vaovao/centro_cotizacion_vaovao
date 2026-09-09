import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useQuotations, useCreateQuotation, mapQuotation } from './quotations.js';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('mapQuotation', () => {
  it('maps snake_case fields to camelCase and coerces monto/impuestos to numbers', () => {
    const mapped = mapQuotation({
      id: 1, correlativo_general: 'PC-2026-001', correlativo_cliente: 'PC-C807-001', fecha: '2026-07-10',
      validez_dias: 30, client_id: 1, cliente_nombre_libre: null, pais: 'Guatemala', linea_servicio: 'Video',
      executive_id: 1, proyecto: 'Contenidos', descripcion: '', detalle: ['x'], monto: '3100.00', impuestos: '372.00',
      moneda: 'GTQ', estatus: 'Enviada', fecha_aprobacion: null, fecha_cierre_proyecto: null, observaciones: '',
      version: 1, previous_version_id: null, superseded_by: null, root_id: 1
    });
    expect(mapped.correlativoGeneral).toBe('PC-2026-001');
    expect(mapped.monto).toBe(3100);
    expect(mapped.impuestos).toBe(372);
    expect(typeof mapped.monto).toBe('number');
  });
});

describe('useQuotations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('builds a query string from filters and maps the results', async () => {
    api.get.mockResolvedValue([{ id: 1, correlativo_general: 'PC-2026-001', monto: '100', impuestos: '12' }]);
    const { result } = renderHook(() => useQuotations({ estatus: 'Aprobada' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/quotations?estatus=Aprobada');
    expect(result.current.data[0].monto).toBe(100);
  });
});

describe('useCreateQuotation', () => {
  it('posts to /quotations', async () => {
    api.post.mockResolvedValue({ id: 1, monto: '100', impuestos: '12' });
    const { result } = renderHook(() => useCreateQuotation(), { wrapper });
    await result.current.mutateAsync({ proyecto: 'P', clientId: 1, executiveId: 1, detalle: ['x'], monto: 100 });
    expect(api.post).toHaveBeenCalledWith('/quotations', { proyecto: 'P', clientId: 1, executiveId: 1, detalle: ['x'], monto: 100 });
  });
});
