import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { EN_VIVO, queryKeys } from './queryKeys';
import type { AprendicesDeGrupo, Grupo } from '../types/api';

/** GET /api/grupos: fichas con aprendices registrados y reservas de hoy. */
export const useGrupos = () =>
  useQuery({
    queryKey: queryKeys.grupos,
    queryFn: async () => (await apiClient.get<Grupo[]>('/grupos')).data,
    ...EN_VIVO,
  });

/** GET /api/grupos/:id/aprendices: solo se consulta cuando la tarjeta está abierta. */
export const useAprendicesDeGrupo = (grupoId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.aprendicesDeGrupo(grupoId),
    queryFn: async () => (await apiClient.get<AprendicesDeGrupo>(`/grupos/${grupoId}/aprendices`)).data,
    enabled,
    ...EN_VIVO,
  });

/** PATCH /api/grupos/ventas/:ventaId/pago: Pagado / No pagado de la reserva de un aprendiz. */
export const useMarcarPagoAprendiz = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ventaId, pagado }: { ventaId: string; pagado: boolean }) =>
      (await apiClient.patch(`/grupos/ventas/${ventaId}/pago`, { pagado })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grupos });
      queryClient.invalidateQueries({ queryKey: queryKeys.ventas });
      queryClient.invalidateQueries({ queryKey: queryKeys.resumenEncargado });
    },
  });
};
