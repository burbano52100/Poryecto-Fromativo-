import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '../schemas/auth.schema';

/** Renderiza con React Query (sin reintentos) y un router en memoria. */
export const renderConProveedores = (ui: ReactNode, { ruta = '/' }: { ruta?: string } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    ),
  };
};

export const usuarioDePrueba = (overrides: Partial<User> = {}): User => ({
  id: '00000000-0000-0000-0000-000000000001',
  document: '1005678901',
  name: 'Usuario de Prueba',
  role: 'aprendiz',
  email: 'prueba@misena.edu.co',
  status: 'ACTIVE',
  es_beneficiario: false,
  ...overrides,
});

/** Respuesta mínima de Axios para usar con vi.spyOn(apiClient, ...). */
export const respuesta = <T,>(data: T) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} },
});
