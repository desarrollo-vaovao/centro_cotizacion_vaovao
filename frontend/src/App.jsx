import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { NuevaCotizacionPage } from './pages/NuevaCotizacionPage.jsx';
import { HistorialPage } from './pages/HistorialPage.jsx';
import { FichaClientePage } from './pages/FichaClientePage.jsx';
import { CatalogoPage } from './pages/CatalogoPage.jsx';
import { DocViewPage } from './pages/DocViewPage.jsx';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="nueva" element={<NuevaCotizacionPage />} />
              <Route path="ajustar/:id" element={<NuevaCotizacionPage />} />
              <Route path="historial" element={<HistorialPage />} />
              <Route path="ficha" element={<FichaClientePage />} />
              <Route path="catalogo" element={<CatalogoPage />} />
              <Route path="cotizacion/:id" element={<DocViewPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
