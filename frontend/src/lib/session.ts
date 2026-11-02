import type { User } from '../schemas/auth.schema';

/** Claves de la sesión en localStorage (ver ADR 005 en docs/DECISIONES.md). */
const TOKEN_KEY = 'gastrosena_token';
const ROLE_KEY = 'gastrosena_role';
const USER_KEY = 'gastrosena_user';

/** Evento global que dispara el interceptor de Axios cuando el backend responde 401. */
export const LOGOUT_EVENT = 'gastrosena:logout';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const guardarSesion = (token: string, user: User): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, user.role);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const actualizarUsuarioGuardado = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const limpiarSesion = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_KEY);
};

export const rutaInicio = (role: User['role']): string => `/${role}/inicio`;
