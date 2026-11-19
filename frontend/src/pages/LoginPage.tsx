import { useState } from 'react';
import { Card } from '@heroui/react';
import { Navigate } from 'react-router-dom';
import { AuthLayout } from '../components/templates/AuthLayout';
import { Header } from '../components/organisms/Header';
import { LoginForm } from '../components/organisms/LoginForm';
import { HelpModal } from '../components/organisms/HelpModal';
import { LoadingSpinner } from '../components/atoms/LoadingSpinner';
import { useCurrentUserQuery } from '../hooks/useAuth';
import { rutaInicio } from '../lib/session';

export const LoginPage = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { data: user, isPending } = useCurrentUserQuery();

  // Con sesión activa (o recién iniciada), /login lleva al panel del rol
  if (user) return <Navigate to={rutaInicio(user.role)} replace />;

  return (
    <>
      <AuthLayout header={<Header />} onOpenHelp={() => setIsHelpOpen(true)}>
        {isPending ? (
          <Card className="w-full max-w-md">
            <LoadingSpinner label="Verificando sesión..." />
          </Card>
        ) : (
          <LoginForm />
        )}
      </AuthLayout>

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};

export default LoginPage;
