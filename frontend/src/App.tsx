import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import { AprendizDashboardPage } from './pages/AprendizDashboardPage';
import { InstructorDashboardPage } from './pages/InstructorDashboardPage';
import { EncargadoDashboardPage } from './pages/EncargadoDashboardPage';
import { InvitadoDashboardPage } from './pages/InvitadoDashboardPage';
import { useCurrentUserQuery, AUTH_QUERY_KEY } from './hooks/useAuth';
import type { User } from './schemas/auth.schema';

export function App() {
  const queryClient = useQueryClient();
  const { data: currentUser, refetch } = useCurrentUserQuery();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/login';
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('gastrosena_token'));
  const [storedRole, setStoredRole] = useState<string | null>(() => localStorage.getItem('gastrosena_role'));

  // Determinar rol activo y autenticación
  const activeRole = currentUser?.role || storedRole;
  const isAuthenticated = Boolean(token && activeRole);

  // Reconstituir usuario desde currentUser o sesión local
  const sessionUser: User | null = useMemo(() => {
    if (currentUser) return currentUser;
    const raw = localStorage.getItem('gastrosena_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }, [currentUser]);

  // Manejador del evento global de cierre de sesión (ej. error 401 de token vencido)
  useEffect(() => {
    const handleLogoutEvent = () => {
      setToken(null);
      setStoredRole(null);
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      setCurrentPath('/login');
      window.history.replaceState({}, '', '/login');
    };

    window.addEventListener('gastrosena:logout', handleLogoutEvent);
    return () => window.removeEventListener('gastrosena:logout', handleLogoutEvent);
  }, [queryClient]);

  // Derivar ruta efectiva autorizada (Casos a, b, c) sin llamar a setState en effects
  const effectivePath = useMemo(() => {
    const rawPath = currentPath === '/' ? '/login' : currentPath;

    // Caso c: Sin sesión, cualquier ruta protegida lleva a /login
    if (!isAuthenticated) {
      return '/login';
    }

    // Caso a: Con sesión activa, entrar a / o /login redirige al panel del rol
    if (rawPath === '/login' || rawPath === '/') {
      return `/${activeRole}/inicio`;
    }

    // Caso b: Un rol autenticado que intenta entrar a la ruta de otro rol es redirigido a su propio panel
    const allowedPrefix = `/${activeRole}`;
    const protectedPrefixes = ['/aprendiz', '/instructor', '/encargado', '/invitado'];
    const isTargetingOtherRole = protectedPrefixes.some(
      (prefix) => prefix !== allowedPrefix && rawPath.startsWith(prefix)
    );

    if (isTargetingOtherRole) {
      return `/${activeRole}/inicio`;
    }

    return rawPath;
  }, [isAuthenticated, activeRole, currentPath]);

  // Sincronizar la barra de direcciones del navegador con la ruta autorizada
  useEffect(() => {
    if (window.location.pathname !== effectivePath) {
      window.history.replaceState({}, '', effectivePath);
    }
  }, [effectivePath]);

  // Soporte para botones adelante/atrás del navegador
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/login');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('gastrosena_token');
    localStorage.removeItem('gastrosena_role');
    localStorage.removeItem('gastrosena_user');
    setToken(null);
    setStoredRole(null);
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    setCurrentPath('/login');
    window.history.pushState({}, '', '/login');
  };

  const handleLoginSuccess = (role: string) => {
    setToken(localStorage.getItem('gastrosena_token'));
    setStoredRole(role);
    refetch();
    const targetPath = `/${role}/inicio`;
    setCurrentPath(targetPath);
    window.history.pushState({}, '', targetPath);
  };

  return (
    <div className="relative">
      {/* Barra de Rutas: Solo visible en entorno DEV para pruebas */}
      {import.meta.env.DEV && (
        <div className="fixed top-2 right-2 z-50 bg-black/85 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border border-white/20 shadow-2xl">
          <span className="text-gray-400">Rutas (DEV):</span>
          <button
            onClick={() => {
              setCurrentPath('/login');
              window.history.pushState({}, '', '/login');
            }}
            className={`px-2.5 py-0.5 rounded-full cursor-pointer transition ${
              effectivePath === '/login' ? 'bg-green-600 text-white font-bold' : 'hover:bg-white/20 text-gray-300'
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
              effectivePath.includes('/aprendiz') ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-white/20 text-gray-300'
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
              effectivePath.includes('/instructor') ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-white/20 text-gray-300'
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
              effectivePath.includes('/encargado') ? 'bg-amber-600 text-white font-bold' : 'hover:bg-white/20 text-gray-300'
            }`}
          >
            /encargado/inicio
          </button>

          <button
            onClick={() => {
              setCurrentPath('/invitado/inicio');
              window.history.pushState({}, '', '/invitado/inicio');
            }}
            className={`px-2.5 py-0.5 rounded-full cursor-pointer transition ${
              effectivePath.includes('/invitado') ? 'bg-teal-600 text-white font-bold' : 'hover:bg-white/20 text-gray-300'
            }`}
          >
            /invitado/inicio
          </button>
        </div>
      )}

      {/* Renderizado Condicional Protegido por Rol */}
      {isAuthenticated && activeRole === 'aprendiz' && effectivePath.includes('/aprendiz') ? (
        <AprendizDashboardPage
          user={
            sessionUser || {
              id: 'usr_aprendiz',
              document: '',
              name: 'Aprendiz GastroSENA',
              role: 'aprendiz',
              email: 'aprendiz@misena.edu.co',
              status: 'ACTIVE',
              ficha: '2847251',
              es_beneficiario: true,
            }
          }
          onLogout={handleLogout}
        />
      ) : isAuthenticated && activeRole === 'instructor' && effectivePath.includes('/instructor') ? (
        <InstructorDashboardPage
          user={
            sessionUser || {
              id: 'usr_instructor',
              document: '',
              name: 'Instructor SENA',
              role: 'instructor',
              email: 'instructor@sena.edu.co',
              status: 'ACTIVE',
            }
          }
          onLogout={handleLogout}
        />
      ) : isAuthenticated && activeRole === 'encargado' && effectivePath.includes('/encargado') ? (
        <EncargadoDashboardPage
          user={
            sessionUser || {
              id: 'usr_encargado',
              document: '',
              name: 'Encargado Comedor',
              role: 'encargado',
              email: 'encargado@sena.edu.co',
              status: 'ACTIVE',
            }
          }
          onLogout={handleLogout}
        />
      ) : isAuthenticated && activeRole === 'invitado' && effectivePath.includes('/invitado') ? (
        <InvitadoDashboardPage
          user={
            sessionUser || {
              id: 'usr_invitado',
              document: '',
              name: 'Visitante Institucional',
              role: 'invitado',
              email: 'visitante@sena.edu.co',
              status: 'ACTIVE',
            }
          }
          onLogout={handleLogout}
        />
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
