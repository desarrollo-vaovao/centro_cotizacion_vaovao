import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './AppLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: vi.fn()
}));

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ logout: vi.fn() });
  });

  it('renders all five nav items', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="dashboard" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Nueva cotización' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Historial' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ficha de cliente' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('calls logout when "Cerrar sesión" is clicked', () => {
    const logout = vi.fn();
    useAuth.mockReturnValue({ logout });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="dashboard" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    screen.getByRole('button', { name: 'Cerrar sesión' }).click();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
