import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { 
  loginSchema, 
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
 * Hook personalizado para consultar el usuario actual (GET /api/auth/me)
 * Usa Zod safeParse/parse para validar la respuesta antes de devolverla a la UI.
 */
export const useCurrentUserQuery = () => {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<User | null> => {
      const token = localStorage.getItem('gastrosena_token');
      if (!token) return null;

      try {
        const response = await apiClient.get('/auth/me');
        // Validación con Zod
        const parsed = userSchema.safeParse(response.data?.user);
        if (!parsed.success) {
          console.error('Data del backend mal formada:', parsed.error);
          throw new Error('Formato de usuario recibido desde la API inválido.');
        }
        return parsed.data;
      } catch (err) {
        localStorage.removeItem('gastrosena_token');
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache fresco
  });
};

/**
 * Hook personalizado para Mutation de Login (POST /api/auth/login)
 * Valida datos con Zod e invalida la caché de TanStack Query en onSuccess.
 */
export const useLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginInput): Promise<AuthResponse> => {
      // 1. Validar payload de entrada con Zod antes de enviar
      const validatedInput = loginSchema.parse(credentials);

      // 2. Petición con Axios centralizado
      const response = await apiClient.post('/auth/login', validatedInput);

      // 3. Validar respuesta del backend con Zod schema
      const parsedResponse = authResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        console.error('Error de schema en respuesta de login:', parsedResponse.error);
        throw new Error('La respuesta del servidor no coincide con el schema esperado.');
      }

      return parsedResponse.data;
    },
    onSuccess: (data) => {
      // Guardar token en localStorage
      localStorage.setItem('gastrosena_token', data.token);
      // Rule 2: Invalidación de caché explícita de TanStack Query
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
};

/**
 * Hook personalizado para Reconocimiento Facial (POST /api/auth/facial-login)
 */
export const useFacialLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FacialLoginInput): Promise<AuthResponse> => {
      const response = await apiClient.post('/auth/facial-login', payload);
      
      const parsedResponse = authResponseSchema.safeParse(response.data);
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
