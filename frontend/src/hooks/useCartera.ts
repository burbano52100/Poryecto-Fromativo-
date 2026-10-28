// src/hooks/useCartera.ts
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface Deuda {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

/** Fetch user's debt (cartera) */
export const useCartera = (): UseQueryResult<Deuda[], Error> => {
  return useQuery<Deuda[], Error>({
    queryKey: ['cartera', 'deudas'],
    queryFn: async () => {
      const { data } = await apiClient.get<Deuda[]>('/deudas');
      return data;
    },
    staleTime: 30_000,
    retry: false,
  });
};
