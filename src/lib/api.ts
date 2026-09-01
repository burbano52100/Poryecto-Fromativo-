import axios from 'axios';

// URL base configurada desde variable de entorno .env (VITE_API_URL)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor para agregar token si existe
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('gastrosena_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
