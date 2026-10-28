import axios from 'axios';

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
  const token = localStorage.getItem('gastrosena_token');
  if (config.headers) {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Encabezado para túneles gratuitos ngrok
    config.headers['ngrok-skip-browser-warning'] = 'true';
  }
  return config;
});

// Interceptor de respuestas: maneja 401 cerrando sesión y redirigiendo a #/login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gastrosena_token');
      localStorage.removeItem('gastrosena_role');
      localStorage.removeItem('gastrosena_user');

      // Redireccionar al login si no estamos ya en él
      if (!window.location.hash.includes('/login')) {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(error);
  }
);
