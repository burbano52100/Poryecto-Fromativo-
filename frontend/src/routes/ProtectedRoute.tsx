// src/routes/ProtectedRoute.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentUserQuery } from '../hooks/useAuth';

interface ProtectedRouteProps {
  allowedRoles: string[]; // e.g. ['aprendiz']
  children: React.ReactNode;
}

/**
 * Checks if a user is authenticated and has one of the allowed roles.
 * If not authenticated, redirects to #/login.
 * If authenticated but role not allowed, redirects to the user's default start page.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { data: currentUser } = useCurrentUserQuery();
  const location = useLocation();

  if (!currentUser) {
    // Not logged in – go to login preserving intended location
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = currentUser.role;
  if (!allowedRoles.includes(role)) {
    // Role mismatch – send to role's home page
    const base = `/${role}/inicio`;
    return <Navigate to={base} replace />;
  }

  return <>{children}</>;
};
