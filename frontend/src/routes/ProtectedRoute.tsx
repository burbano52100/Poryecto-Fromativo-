import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUserQuery } from '../hooks/useAuth';
import { rutaInicio } from '../lib/session';
import { DashboardSkeleton } from '../components/templates/DashboardSkeleton';
import { CambiarClaveObligatoriaModal } from '../components/organisms/CambiarClaveObligatoriaModal';
import type { AccountType, User } from '../schemas/auth.schema';

interface ProtectedRouteProps {
  role: AccountType;
  children: (user: User) => ReactNode;
}

/**
 * Sin sesión → #/login. Con sesión de otro rol → panel de su propio rol.
 * Solo renderiza el panel cuando el rol de la sesión coincide. Si la cuenta debe cambiar su
 * contraseña inicial, el panel queda bloqueado detrás del formulario de cambio.
 */
export const ProtectedRoute = ({ role, children }: ProtectedRouteProps) => {
  const { data: user, isPending } = useCurrentUserQuery();

  if (isPending) return <DashboardSkeleton label="Verificando sesión..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={rutaInicio(user.role)} replace />;

  return (
    <>
      {children(user)}
      {user.debe_cambiar_clave && <CambiarClaveObligatoriaModal user={user} />}
    </>
  );
};
