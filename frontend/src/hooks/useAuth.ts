import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loginWithPassword, registerUser, fetchCurrentUser } from '../lib/authService';
import { actualizarUsuarioGuardado, getToken, guardarSesion, limpiarSesion } from '../lib/session';
import type { LoginInput, RegisterInput, AuthResponse, User } from '../schemas/auth.schema';

export const AUTH_QUERY_KEY = ['currentUser'] as const;

/**
 * Usuario en sesión (GET /api/auth/me). Devuelve null si no hay token o si el backend
 * ya no reconoce la sesión.
 */
export const useCurrentUserQuery = () => {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<User | null> => {
      if (!getToken()) return null;
      const user = await fetchCurrentUser();
      if (user) actualizarUsuarioGuardado(user);
      else limpiarSesion();
      return user;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};

/** Guarda la sesión y publica el usuario: las rutas redirigen solas al panel de su rol. */
const useIniciarSesion = () => {
  const queryClient = useQueryClient();
  return useCallback(
    (data: AuthResponse) => {
      guardarSesion(data.token, data.user);
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
    },
    [queryClient]
  );
};

/** POST /api/auth/login: solo documento y contraseña; el rol lo devuelve el backend. */
export const useLoginMutation = () => {
  const iniciarSesion = useIniciarSesion();
  return useMutation({
    mutationFn: (credentials: LoginInput) => loginWithPassword(credentials),
    onSuccess: iniciarSesion,
  });
};

/** POST /api/auth/register: crea la cuenta e inicia sesión con ella. */
export const useRegisterMutation = () => {
  const iniciarSesion = useIniciarSesion();
  return useMutation({
    mutationFn: (userData: RegisterInput) => registerUser(userData),
    onSuccess: iniciarSesion,
  });
};

/** Actualiza el usuario en sesión tras editar el perfil. */
export const useActualizarUsuarioSesion = () => {
  const queryClient = useQueryClient();
  return useCallback(
    (user: User) => {
      actualizarUsuarioGuardado(user);
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
    },
    [queryClient]
  );
};

/** Cierra la sesión y descarta los datos en caché del usuario anterior. */
export const useLogout = () => {
  const queryClient = useQueryClient();
  return useCallback(() => {
    limpiarSesion();
    queryClient.clear();
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
  }, [queryClient]);
};
