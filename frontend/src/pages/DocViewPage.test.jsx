import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DocViewPage } from './DocViewPage.jsx';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn() } }));
const pdf = vi.hoisted(() => ({ sizes: [], instances: [], canvas: null }));

vi.mock('html2canvas', () => ({
  default: vi.fn().mockImplementation(async () => pdf.canvas)
}));
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation((options) => {
    const instance = {
      options,
      internal: { pageSize: { getWidth: () => 612 } },
      addImage: vi.fn(),
      save: vi.fn(),
      output: vi.fn(() => ({ size: pdf.sizes.shift() ?? 400_000 }))
    };
    pdf.instances.push(instance);
    return instance;
  })
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/cotizacion/1']}>
        <Routes><Route path="/cotizacion/:id" element={<DocViewPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DocViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdf.sizes = [];
    pdf.instances = [];
    pdf.canvas = { toDataURL: vi.fn(() => 'data:image/jpeg;base64,x'), width: 1120, height: 1450 };
    api.get.mockImplementation((path) => {
      if (path.startsWith('/quotations')) return Promise.resolve([
        { id: 1, correlativo_general: 'PC-2026-001', correlativo_cliente: 'PC-C807-001', fecha: '2026-07-10', validez_dias: 30, client_id: 1, cliente_nombre_libre: null, pais: 'Guatemala', linea_servicio: 'Video', executive_id: 1, proyecto: 'Contenidos', descripcion: 'Grabación', detalle: ['Edición de 6 videos'], monto: '3100', impuestos: '372', moneda: 'GTQ', estatus: 'Enviada', version: 1, fecha_aprobacion: null, fecha_cierre_proyecto: null, observaciones: null, previous_version_id: null, superseded_by: null, root_id: 1 }
      ]);
      if (path === '/clients') return Promise.resolve([{ id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 1 }]);
      if (path === '/settings/logos') return Promise.resolve({ logo_agencia: null, logo_velarc: null });
      return Promise.resolve([]);
    });
  });

  it('renders the quotation document with client, project, and total', async () => {
    renderPage();
    expect(await screen.findByText('PC-2026-001')).toBeInTheDocument();
    expect(screen.getByText('C807 Operador')).toBeInTheDocument();
    expect(screen.getByText('Edición de 6 videos', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Q3,472.00')).toBeInTheDocument();
  });

  it('downloads a compressed JPEG-based PDF named after the correlativo', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }));

    await waitFor(() => expect(pdf.instances[0].save).toHaveBeenCalledWith('PC-2026-001.pdf'));
    expect(pdf.instances).toHaveLength(1);
    expect(pdf.instances[0].options.compress).toBe(true);
    expect(pdf.canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(pdf.instances[0].addImage.mock.calls[0][1]).toBe('JPEG');
  });

  it('lowers the JPEG quality until the PDF fits under 1MB', async () => {
    pdf.sizes = [2_400_000, 1_300_000, 700_000];
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }));

    await waitFor(() => expect(pdf.instances).toHaveLength(3));
    expect(pdf.canvas.toDataURL.mock.calls.map((c) => c[1])).toEqual([0.85, 0.7, 0.55]);
    expect(pdf.instances[2].save).toHaveBeenCalledWith('PC-2026-001.pdf');
    expect(pdf.instances[0].save).not.toHaveBeenCalled();
  });

  it('shows placeholder boxes when logos are missing', async () => {
    renderPage();
    expect(await screen.findByText('Logo agencia')).toBeInTheDocument();
    expect(screen.getByText('Logo VELARC')).toBeInTheDocument();
  });
});
