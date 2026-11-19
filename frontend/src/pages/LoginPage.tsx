import { useState } from 'react';
import { Card } from '@heroui/react';
import { Hueso } from '../components/atoms/Hueso';
import { Navigate } from 'react-router-dom';
import { AuthLayout } from '../components/templates/AuthLayout';
import { Header } from '../components/organisms/Header';
import { LoginForm } from '../components/organisms/LoginForm';
import { HelpModal } from '../components/organisms/HelpModal';
import { useCurrentUserQuery } from '../hooks/useAuth';
import { rutaInicio } from '../lib/session';

/** Forma de la tarjeta de inicio de sesión mientras se verifica si ya hay sesión (Skeleton de HeroUI). */
const LoginSkeleton = () => (
  <Card
    role="status"
    aria-label="Verificando sesión..."
    className="skeleton--shimmer relative w-full max-w-md gap-5 overflow-hidden p-6 sm:p-8"
  >
    <div className="flex flex-col items-center gap-2">
      <Hueso className="h-5 w-36 rounded-md" />
      <Hueso className="h-3.5 w-56 rounded-md" />
    </div>
    {[0, 1].map((i) => (
      <div key={i} className="flex flex-col gap-1.5">
        <Hueso className="h-3.5 w-40 rounded-md" />
        <Hueso className="h-10 rounded-xl" />
      </div>
    ))}
    <Hueso className="h-11 rounded-full" />
    <Hueso className="mx-auto h-3.5 w-44 rounded-md" />
  </Card>
);

export const LoginPage = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { data: user, isPending } = useCurrentUserQuery();

  // Con sesión activa (o recién iniciada), /login lleva al panel del rol
  if (user) return <Navigate to={rutaInicio(user.role)} replace />;

  return (
    <>
      <AuthLayout header={<Header />} onOpenHelp={() => setIsHelpOpen(true)}>
        {isPending ? (
          <LoginSkeleton />
        ) : (
          <LoginForm />
        )}
      </AuthLayout>

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};

export default LoginPage;
