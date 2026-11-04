import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { EN_VIVO, queryKeys } from './queryKeys';
import type { FiltroSolicitudes, SolicitudCuenta } from '../types/api';

/** GET /api/solicitudes-cuenta?estado=: solicitudes de cuenta de instructor y encargado (ADR 015). */
export const useSolicitudesCuenta = (estado: FiltroSolicitudes) =>
  useQuery({
    queryKey: queryKeys.solicitudesPorEstado(estado),
    queryFn: async () =>
      (await apiClient.get<SolicitudCuenta[]>('/solicitudes-cuenta', { params: { estado } })).data,
    ...EN_VIVO,
  });

/** Tras aprobar o rechazar se refrescan las listas y el contador del Sidebar. */
const useRefrescarSolicitudes = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.solicitudes });
    queryClient.invalidateQueries({ queryKey: queryKeys.resumenEncargado });
  };
};

export const useAprobarSolicitud = () => {
  const refrescar = useRefrescarSolicitudes();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<{ message: string }>(`/solicitudes-cuenta/${id}/aprobar`)).data,
    onSuccess: refrescar,
  });
};

export const useRechazarSolicitud = () => {
  const refrescar = useRefrescarSolicitudes();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) =>
      (await apiClient.post<{ message: string }>(`/solicitudes-cuenta/${id}/rechazar`, motivo ? { motivo } : {})).data,
    onSuccess: refrescar,
  });
};
