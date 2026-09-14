import axios from 'axios';

// URL base del backend desde la variable de entorno .env (Regla 1)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor de solicitudes para adjuntar token JWT y header de rol autenticado
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('gastrosena_token');
  if (config.headers) {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Asignación de header de rol para validaciones del middleware (por defecto 'encargado' en el cliente autenticado)
    config.headers['x-user-role'] = localStorage.getItem('gastrosena_role') || 'encargado';
    // Evita la página de aviso interstitial de ngrok cuando el backend se expone con un túnel gratuito
    config.headers['ngrok-skip-browser-warning'] = 'true';
  }
  return config;
});
