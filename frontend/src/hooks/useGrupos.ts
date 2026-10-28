// src/hooks/useGrupos.ts
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import api from '../lib/api';

export interface Grupo {
  id: string;
  name: string;
  instructorId: string;
}

/** Fetch groups */
export const useGrupos = (): UseQueryResult<Grupo[], Error> => {
  return useQuery<Grupo[], Error>(
    ['grupos'],
    async () => {
      const { data } = await api.get<Grupo[]>('/grupos');
      return data;
    },
    {
      staleTime: 30_000,
      retry: false,
    }
  );
};
