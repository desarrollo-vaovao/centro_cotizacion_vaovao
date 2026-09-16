import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="p-8 text-text-secondary">Cargando…</div>;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (user?.mustChangePassword && location.pathname !== '/cambiar-contrasena') {
    return <Navigate to="/cambiar-contrasena" replace />;
  }
  return children;
}
