import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionContext';

export default function RequireRole({ role }) {
  const { session } = useSession();

  if (!session || session.role !== role) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
