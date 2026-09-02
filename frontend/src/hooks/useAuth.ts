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
<<<<<<< Updated upstream:frontend/src/hooks/useAuth.ts
 * Hook personalizado para consultar el usuario actual a partir del token
 * guardado en localStorage (GET /api/auth/me en el backend local).
=======
 * Hook para consultar el usuario actual en sesión (GET /api/auth/me)
>>>>>>> Stashed changes:src/hooks/useAuth.ts
 */
export const useCurrentUserQuery = () => {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<User | null> => {
      if (!localStorage.getItem('gastrosena_token')) return null;

<<<<<<< Updated upstream:frontend/src/hooks/useAuth.ts
      const user = await fetchCurrentUser();
      if (!user) {
        localStorage.removeItem('gastrosena_token');
        return null;
      }

      const parsed = userSchema.safeParse(user);
      if (!parsed.success) {
        console.error('Data del backend mal formada:', parsed.error);
        localStorage.removeItem('gastrosena_token');
        return null;
      }
      return parsed.data;
=======
      try {
        const response = await apiClient.get('/auth/me');
        const parsed = userSchema.safeParse(response.data?.user);
        if (!parsed.success) {
          throw new Error('Formato de usuario devuelto por el servidor no válido');
        }
        return parsed.data;
      } catch (error) {
        localStorage.removeItem('gastrosena_token');
        return null;
      }
>>>>>>> Stashed changes:src/hooks/useAuth.ts
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
<<<<<<< Updated upstream:frontend/src/hooks/useAuth.ts
 * Hook personalizado para Mutation de Login (POST /api/auth/login en el backend local)
=======
 * Hook Mutation para Registro Real de Usuario (POST /api/auth/register) - OPCIÓN A
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
 * Hook Mutation para Inicio de Sesión Tradicional (POST /api/auth/login)
>>>>>>> Stashed changes:src/hooks/useAuth.ts
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
<<<<<<< Updated upstream:frontend/src/hooks/useAuth.ts
 * Hook personalizado para Reconocimiento Facial (simulado: el backend local
 * responde con el primer usuario mock, sin embeddings reales).
=======
 * Hook Mutation para Reconocimiento Facial (POST /api/auth/facial-login)
>>>>>>> Stashed changes:src/hooks/useAuth.ts
 */
export const useFacialLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FacialLoginInput): Promise<AuthResponse> => {
      const response = await apiClient.post('/auth/facial-login', payload);
      
      const parsedResponse = authResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new Error('La respuesta de biometría no coincide con el schema esperado.');
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
