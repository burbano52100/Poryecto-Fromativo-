import { useState } from 'react';
import { AuthLayout } from '../components/templates/AuthLayout';
import { Header } from '../components/organisms/Header';
import { LoginForm } from '../components/organisms/LoginForm';
import { HelpModal } from '../components/organisms/HelpModal';
import { useCurrentUserQuery } from '../hooks/useAuth';

export const LoginPage = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Hook de TanStack Query para comprobar si hay usuario autenticado en la app
  const { data: currentUser, isLoading } = useCurrentUserQuery();

  return (
    <>
      <AuthLayout
        header={<Header />}
        onOpenHelp={() => setIsHelpOpen(true)}
      >
        {/* Si está cargando la sesión actual */}
        {isLoading ? (
          <div className="bg-white/90 p-8 rounded-3xl text-center shadow-xl">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">Verificando sesión GastroSENA...</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {currentUser && (
              <div className="mb-4 bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-md animate-fade-in">
                Sesión Activa: {currentUser.name} ({currentUser.role.toUpperCase()})
              </div>
            )}
            <LoginForm />
          </div>
        )}
      </AuthLayout>

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};

export default LoginPage;
