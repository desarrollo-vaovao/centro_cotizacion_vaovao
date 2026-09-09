import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { FichaClientePage } from './FichaClientePage.jsx';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><FichaClientePage /></QueryClientProvider>);
}

describe('FichaClientePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path === '/clients') return Promise.resolve([{ id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 2 }]);
      if (path.startsWith('/dashboard/cliente/')) return Promise.resolve({ period: 'mes', count: 2, kpis: { montoPeriodo: 5000, montoAprobado: 3000, montoPerdido: 0, tasa: 100 }, lineas: [['Video', 5000]] });
      return Promise.resolve([]);
    });
  });

  it('shows a prompt before a client is selected', async () => {
    renderPage();
    expect(await screen.findByText('Selecciona un cliente para ver su histórico.')).toBeInTheDocument();
  });

  it('loads client KPIs after selecting a client', async () => {
    renderPage();
    const select = await screen.findByLabelText('Cliente');
    await screen.findByRole('option', { name: 'C807 Operador' });
    await userEvent.selectOptions(select, '1');
    expect(await screen.findByText('Q5,000.00')).toBeInTheDocument();
  });
});
