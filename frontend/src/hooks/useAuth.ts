import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import {
  loginSchema,
  registerSchema,
  authResponseSchema,
  userSchema,
  type LoginInput,
  type RegisterInput,
  type FacialLoginInput,
  type AuthResponse,
  type User
} from '../schemas/auth.schema';

export const AUTH_QUERY_KEY = ['currentUser'];

/**
* Hook para consultar el usuario actual en sesion (GET /api/auth/me)
*/
export const useCurrentUserQuery = () => {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<User | null> => {
      if (!localStorage.getItem('gastrosena_token')) return null;

    try {
      const response = await apiClient.get('/auth/me');
      const parsed = userSchema.safeParse(response.data?.user);
      if (!parsed.success) {
        throw new Error('Formato de usuario devuelto por el servidor no valido');
      }
      return parsed.data;
    } catch (error) {
      localStorage.removeItem('gastrosena_token');
      return null;
    }
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
      const validatedInput = registerSchema.parse(userData);
      const response = await apiClient.post('/auth/register', validatedInput);

    const parsedResponse = authResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new Error('La respuesta del servidor no coincide con el schema esperado.');
      }

    return parsedResponse.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('gastrosena_token', data.token);
      localStorage.setItem('gastrosena_role', data.user.role);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};

/**
* Hook Mutation para Inicio de Sesion Tradicional (POST /api/auth/login)
*/
export const useLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginInput): Promise<AuthResponse> => {
      const validatedInput = loginSchema.parse(credentials);
      const response = await apiClient.post('/auth/login', validatedInput);

    const parsedResponse = authResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new Error('La respuesta del servidor no coincide con el schema esperado.');
      }

    return parsedResponse.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('gastrosena_token', data.token);
      localStorage.setItem('gastrosena_role', data.user.role);
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
      const response = await apiClient.post('/auth/facial-login', payload);

    const parsedResponse = authResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new Error('La respuesta de biometria no coincide con el schema esperado.');
      }

    return parsedResponse.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('gastrosena_token', data.token);
      localStorage.setItem('gastrosena_role', data.user.role);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};
