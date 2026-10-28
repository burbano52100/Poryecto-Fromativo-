// src/hooks/useSugerencias.ts
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface Sugerencia {
  id: string;
  user_id: string;
  role: string;
  message: string;
  response?: string;
  created_at: string;
}

/** Fetch suggestions (buzón) for a given role */
export const useSugerencias = (role: string): UseQueryResult<Sugerencia[], Error> => {
  return useQuery<Sugerencia[], Error>({
    queryKey: ['sugerencias', role],
    queryFn: async () => {
      const { data } = await apiClient.get<Sugerencia[]>(`/sugerencias?role=${role}`);
      return data;
    },
    staleTime: 30_000,
    retry: false,
  });
};
