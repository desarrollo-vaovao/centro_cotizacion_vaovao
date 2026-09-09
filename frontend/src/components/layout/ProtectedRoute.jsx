import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <div className="p-8 text-text-secondary">Cargando…</div>;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  return children;
}
