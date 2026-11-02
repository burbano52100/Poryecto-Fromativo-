import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoadingSpinner } from './components/atoms/LoadingSpinner';
import { useLogout } from './hooks/useAuth';
import { LOGOUT_EVENT } from './lib/session';

// Cada panel se descarga solo cuando se entra a él (code splitting)
const AprendizDashboardPage = lazy(() =>
  import('./pages/AprendizDashboardPage').then((m) => ({ default: m.AprendizDashboardPage }))
);
const InstructorDashboardPage = lazy(() =>
  import('./pages/InstructorDashboardPage').then((m) => ({ default: m.InstructorDashboardPage }))
);
const EncargadoDashboardPage = lazy(() =>
  import('./pages/EncargadoDashboardPage').then((m) => ({ default: m.EncargadoDashboardPage }))
);
const InvitadoDashboardPage = lazy(() =>
  import('./pages/InvitadoDashboardPage').then((m) => ({ default: m.InvitadoDashboardPage }))
);

/**
 * Rutas de la app. Sin sesión, cualquier ruta lleva a /login; con sesión, /login lleva a
 * /{rol}/inicio, y un rol que intenta entrar al panel de otro vuelve al suyo.
 */
export const AppRoutes = () => {
  const logout = useLogout();

  // El interceptor de Axios avisa con este evento cuando el backend responde 401
  useEffect(() => {
    window.addEventListener(LOGOUT_EVENT, logout);
    return () => window.removeEventListener(LOGOUT_EVENT, logout);
  }, [logout]);

  return (
    <Suspense fallback={<LoadingSpinner fullScreen label="Cargando panel..." />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/aprendiz/inicio"
          element={
            <ProtectedRoute role="aprendiz">
              {(user) => <AprendizDashboardPage user={user} onLogout={logout} />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor/inicio"
          element={
            <ProtectedRoute role="instructor">
              {(user) => <InstructorDashboardPage user={user} onLogout={logout} />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/encargado/inicio"
          element={
            <ProtectedRoute role="encargado">
              {(user) => <EncargadoDashboardPage user={user} onLogout={logout} />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/invitado/inicio"
          element={
            <ProtectedRoute role="invitado">
              {(user) => <InvitadoDashboardPage user={user} onLogout={logout} />}
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
};

export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}

export default App;
