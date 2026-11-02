import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { EN_VIVO, queryKeys } from './queryKeys';
import type { Sugerencia } from '../types/api';

/** GET /api/sugerencias: el Encargado recibe todas; los demás roles, solo las suyas. */
export const useSugerencias = () =>
  useQuery({
    queryKey: queryKeys.sugerencias,
    queryFn: async () => (await apiClient.get<Sugerencia[]>('/sugerencias')).data,
    ...EN_VIVO,
  });

export const useCrearSugerencia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { asunto: string; mensaje: string }) =>
      (await apiClient.post<{ message: string }>('/sugerencias', data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sugerencias }),
  });
};

export const useResponderSugerencia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, respuesta }: { id: string; respuesta?: string }) =>
      (await apiClient.patch(`/sugerencias/${id}/responder`, respuesta ? { respuesta } : {})).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sugerencias });
      queryClient.invalidateQueries({ queryKey: queryKeys.resumenEncargado });
    },
  });
};
