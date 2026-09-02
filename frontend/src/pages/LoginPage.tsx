import { useState } from 'react';
import { AuthLayout } from '../components/templates/AuthLayout';
import { Header } from '../components/organisms/Header';
import { LoginForm } from '../components/organisms/LoginForm';
import { HelpModal } from '../components/organisms/HelpModal';
import { useCurrentUserQuery } from '../hooks/useAuth';

interface LoginPageProps {
  onLoginSuccess?: (role: string) => void;
}

export const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { isLoading } = useCurrentUserQuery();

  return (
    <>
      <AuthLayout
        header={<Header />}
        onOpenHelp={() => setIsHelpOpen(true)}
      >
        {isLoading ? (
          <div className="bg-white/90 p-8 rounded-3xl text-center shadow-xl">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">Verificando sesión GastroSENA...</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <LoginForm onLoginSuccess={(role) => onLoginSuccess && onLoginSuccess(role)} />
          </div>
        )}
      </AuthLayout>

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};

export default LoginPage;
