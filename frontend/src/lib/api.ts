import axios from 'axios';
import { getToken, limpiarSesion, LOGOUT_EVENT } from './session';

// URL base del backend desde variable de entorno VITE_API_URL (por defecto http://localhost:3000/api)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor de solicitudes: adjunta token Bearer JWT legítimo
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (config.headers) {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Encabezado para túneles gratuitos ngrok
    config.headers['ngrok-skip-browser-warning'] = 'true';
  }
  return config;
});

// Un 401 en login o registro es un error de credenciales, no una sesión vencida
const RUTAS_SIN_SESION = ['/auth/login', '/auth/register'];

// Interceptor de respuestas: un 401 cierra la sesión y avisa a la app, que redirige a #/login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? '';
    if (error.response?.status === 401 && !RUTAS_SIN_SESION.some((ruta) => url.endsWith(ruta))) {
      limpiarSesion();
      window.dispatchEvent(new Event(LOGOUT_EVENT));
    }
    return Promise.reject(error);
  }
);

/** Extrae el mensaje de error que envía el backend ({ message }) o uno genérico. */
export const mensajeDeError = (error: unknown, porDefecto = 'Ocurrió un error inesperado.'): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
    if (error.code === 'ERR_NETWORK') return 'No se pudo conectar con el servidor.';
  }
  return error instanceof Error ? error.message : porDefecto;
};
