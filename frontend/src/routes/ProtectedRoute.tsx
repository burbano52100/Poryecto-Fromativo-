import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUserQuery } from '../hooks/useAuth';
import { rutaInicio } from '../lib/session';
import { LoadingSpinner } from '../components/atoms/LoadingSpinner';
import type { AccountType, User } from '../schemas/auth.schema';

interface ProtectedRouteProps {
  role: AccountType;
  children: (user: User) => ReactNode;
}

/**
 * Sin sesión → #/login. Con sesión de otro rol → panel de su propio rol.
 * Solo renderiza el panel cuando el rol de la sesión coincide.
 */
export const ProtectedRoute = ({ role, children }: ProtectedRouteProps) => {
  const { data: user, isPending } = useCurrentUserQuery();

  if (isPending) return <LoadingSpinner fullScreen label="Verificando sesión GastroSENA..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={rutaInicio(user.role)} replace />;

  return <>{children(user)}</>;
};
