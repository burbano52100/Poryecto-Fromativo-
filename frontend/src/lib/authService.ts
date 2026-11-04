import { isAxiosError } from 'axios';
import { apiClient } from './api';
import type { AuthResponse, LoginInput, RegisterInput, RegisterResponse, User } from '../schemas/auth.schema';

export function toFriendlyError(error: unknown): Error {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return new Error(message);
    if (error.code === 'ERR_NETWORK') {
      return new Error('No se pudo conectar con el servidor. ¿Está corriendo "npm run dev" en backend/?');
    }
  }
  return error instanceof Error ? error : new Error('Error inesperado al conectar con el servidor.');
}

export async function loginWithPassword(input: LoginInput): Promise<AuthResponse> {
  try {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', input);
    return data;
  } catch (error) {
    throw toFriendlyError(error);
  }
}

/** Aprendiz e invitado reciben la sesión; instructor y encargado, una solicitud pendiente (202). */
export async function registerUser(input: RegisterInput): Promise<RegisterResponse> {
  try {
    const { data } = await apiClient.post<RegisterResponse>('/auth/register', input);
    return data;
  } catch (error) {
    throw toFriendlyError(error);
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const { data } = await apiClient.get<{ user: User; activeSession: boolean }>('/auth/me');
    return data.activeSession ? data.user : null;
  } catch {
    return null;
  }
}
