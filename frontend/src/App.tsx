import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import VisitasInstitucionalesPage from './pages/VisitasInstitucionalesPage';
import { AprendizDashboardPage } from './pages/AprendizDashboardPage';
import { InstructorDashboardPage } from './pages/InstructorDashboardPage';
import { useCurrentUserQuery, AUTH_QUERY_KEY } from './hooks/useAuth';

export function App() {
  const queryClient = useQueryClient();
  const { data: currentUser, refetch } = useCurrentUserQuery();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/login';
  });

  const handleLogout = () => {
    localStorage.removeItem('gastrosena_token');
    localStorage.removeItem('gastrosena_role');
    localStorage.removeItem('gastrosena_user');
    queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    setCurrentPath('/login');
    window.history.pushState({}, '', '/login');
  };

  const handleLoginSuccess = (role: string) => {
    refetch();
    let targetPath = '/login';
    if (role === 'aprendiz') targetPath = '/aprendiz/inicio';
    else if (role === 'instructor') targetPath = '/instructor/inicio';
    else if (role === 'encargado') targetPath = '/encargado/inicio';

    setCurrentPath(targetPath);
    window.history.pushState({}, '', targetPath);
  };

  return (
    <div className="relative">
      {/* Barra Superior con Rutas Claras de Navegación Manual */}
      <div className="fixed top-2 right-2 z-50 bg-black/85 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border border-white/20 shadow-2xl">
        <span className="text-gray-400">Rutas:</span>
        <button
          onClick={() => {
            setCurrentPath('/login');
            window.history.pushState({}, '', '/login');
          }}
          className={`px-2.5 py-0.5 rounded-full cursor-pointer transition ${
            currentPath === '/login' ? 'bg-green-600 text-white font-bold' : 'hover:bg-white/20 text-gray-300'
          }`}
        >
          /login
        </button>

        <button
          onClick={() => {
            setCurrentPath('/aprendiz/inicio');
            window.history.pushState({}, '', '/aprendiz/inicio');
          }}
          className={`px-2.5 py-0.5 rounded-full cursor-pointer transition ${
            currentPath.includes('/aprendiz') ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-white/20 text-gray-300'
          }`}
        >
          /aprendiz/inicio
        </button>

        <button
          onClick={() => {
            setCurrentPath('/instructor/inicio');
            window.history.pushState({}, '', '/instructor/inicio');
          }}
          className={`px-2.5 py-0.5 rounded-full cursor-pointer transition ${
            currentPath.includes('/instructor') ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-white/20 text-gray-300'
          }`}
        >
          /instructor/inicio
        </button>

        <button
          onClick={() => {
            setCurrentPath('/encargado/inicio');
            window.history.pushState({}, '', '/encargado/inicio');
          }}
          className={`px-2.5 py-0.5 rounded-full cursor-pointer transition ${
            currentPath.includes('/encargado') ? 'bg-red-600 text-white font-bold' : 'hover:bg-white/20 text-gray-300'
          }`}
        >
          /encargado/inicio
        </button>
      </div>

      {currentPath.includes('/aprendiz') ? (
        <AprendizDashboardPage
          user={currentUser || { id: 'usr_aprendiz', document: '1005678901', name: 'Carlos Ruiz', role: 'aprendiz', email: 'carlos.ruiz@misena.edu.co', status: 'ACTIVE', ficha: '2847251' }}
          onLogout={handleLogout}
        />
      ) : currentPath.includes('/instructor') ? (
        <InstructorDashboardPage
          user={currentUser || { id: 'usr_instructor', document: '1098765432', name: 'María Fernanda Gómez', role: 'instructor', email: 'mgomez@sena.edu.co', status: 'ACTIVE' }}
          onLogout={handleLogout}
        />
      ) : currentPath.includes('/encargado') ? (
        <VisitasInstitucionalesPage />
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
