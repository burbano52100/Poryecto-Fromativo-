// src/hooks/useCartera.ts
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import api from '../lib/api';

export interface Deuda {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

/** Fetch user's debt (cartera) */
export const useCartera = (): UseQueryResult<Deuda[], Error> => {
  return useQuery<Deuda[], Error>(
    ['cartera', 'deudas'],
    async () => {
      const { data } = await api.get<Deuda[]>('/deudas');
      return data;
    },
    {
      staleTime: 30_000,
      retry: false,
    }
  );
};
