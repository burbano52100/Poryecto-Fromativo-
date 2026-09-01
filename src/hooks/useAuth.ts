import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facialLogin, fetchCurrentUser, loginWithPassword } from '../lib/authService';
import {
  authResponseSchema,
  userSchema,
  type LoginInput,
  type FacialLoginInput,
  type AuthResponse,
  type User
} from '../schemas/auth.schema';

// Key constante para el cache de React Query
export const AUTH_QUERY_KEY = ['currentUser'];

/**
 * Hook personalizado para consultar el usuario actual a partir del token
 * guardado en localStorage (consulta directa a Supabase).
 */
export const useCurrentUserQuery = () => {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<User | null> => {
      const token = localStorage.getItem('gastrosena_token');
      if (!token) return null;

      const user = await fetchCurrentUser(token);
      if (!user) {
        localStorage.removeItem('gastrosena_token');
        return null;
      }

      const parsed = userSchema.safeParse(user);
      if (!parsed.success) {
        console.error('Data de Supabase mal formada:', parsed.error);
        localStorage.removeItem('gastrosena_token');
        return null;
      }
      return parsed.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache fresco
  });
};

/**
 * Hook personalizado para Mutation de Login (consulta directa a `usuarios` en Supabase)
 */
export const useLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginInput): Promise<AuthResponse> => {
      const response = await loginWithPassword(credentials);

      const parsedResponse = authResponseSchema.safeParse(response);
      if (!parsedResponse.success) {
        console.error('Error de schema en respuesta de login:', parsedResponse.error);
        throw new Error('La respuesta de Supabase no coincide con el schema esperado.');
      }

      return parsedResponse.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('gastrosena_token', data.token);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};

/**
 * Hook personalizado para Reconocimiento Facial (simulado: valida contra
 * la tabla `reconocimiento_facial` en Supabase, sin embeddings reales).
 */
export const useFacialLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FacialLoginInput): Promise<AuthResponse> => {
      const response = await facialLogin(payload);

      const parsedResponse = authResponseSchema.safeParse(response);
      if (!parsedResponse.success) {
        throw new Error('Respuesta de autenticación biométrica inválida.');
      }

      return parsedResponse.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('gastrosena_token', data.token);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};
