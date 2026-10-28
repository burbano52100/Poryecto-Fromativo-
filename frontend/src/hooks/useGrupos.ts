// src/hooks/useGrupos.ts
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface Grupo {
  id: string;
  name: string;
  instructorId: string;
}

/** Fetch groups */
export const useGrupos = (): UseQueryResult<Grupo[], Error> => {
  return useQuery<Grupo[], Error>({
    queryKey: ['grupos'],
    queryFn: async () => {
      const { data } = await apiClient.get<Grupo[]>('/grupos');
      return data;
    },
    staleTime: 30_000,
    retry: false,
  });
};
