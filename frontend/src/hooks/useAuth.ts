import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loginWithPassword,
  registerUser,
  facialLogin,
  fetchCurrentUser,
} from '../lib/authService';
import {
  type LoginInput,
  type RegisterInput,
  type FacialLoginInput,
  type AuthResponse,
  type User,
} from '../schemas/auth.schema';

export const AUTH_QUERY_KEY = ['currentUser'];

/**
 * Hook para consultar el usuario actual en sesión (GET /api/auth/me)
 */
export const useCurrentUserQuery = () => {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<User | null> => {
      if (!localStorage.getItem('gastrosena_token')) return null;
      const user = await fetchCurrentUser();
      if (!user) {
        localStorage.removeItem('gastrosena_token');
        localStorage.removeItem('gastrosena_role');
        localStorage.removeItem('gastrosena_user');
      }
      return user;
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook Mutation para Registro Real de Usuario (POST /api/auth/register)
 */
export const useRegisterMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: RegisterInput): Promise<AuthResponse> => {
      return await registerUser(userData);
    },
    onSuccess: (data) => {
      localStorage.setItem('gastrosena_token', data.token);
      localStorage.setItem('gastrosena_role', data.user.role);
      localStorage.setItem('gastrosena_user', JSON.stringify(data.user));
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};

/**
 * Hook Mutation para Inicio de Sesión Tradicional (POST /api/auth/login)
 */
export const useLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginInput): Promise<AuthResponse> => {
      return await loginWithPassword(credentials);
    },
    onSuccess: (data) => {
      localStorage.setItem('gastrosena_token', data.token);
      localStorage.setItem('gastrosena_role', data.user.role);
      localStorage.setItem('gastrosena_user', JSON.stringify(data.user));
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};

/**
 * Hook Mutation para Reconocimiento Facial (POST /api/auth/facial-login)
 */
export const useFacialLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FacialLoginInput): Promise<AuthResponse> => {
      return await facialLogin(payload);
    },
    onSuccess: (data) => {
      localStorage.setItem('gastrosena_token', data.token);
      localStorage.setItem('gastrosena_role', data.user.role);
      localStorage.setItem('gastrosena_user', JSON.stringify(data.user));
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};
