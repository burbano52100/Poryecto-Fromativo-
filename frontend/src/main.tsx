import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toast } from '@heroui/react';
import App from './App.tsx';
import './index.css';

// Configuración global del QueryClient de TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Avisos breves de éxito (toast de HeroUI), abajo a la derecha */}
      <Toast.Provider placement="bottom end" />
    </QueryClientProvider>
  </StrictMode>
);
