import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { EN_VIVO, queryKeys } from './queryKeys';
import type {
  AlmuerzoInvitado,
  CambiosAlmuerzoInvitado,
  FiltrosAlmuerzosInvitados,
  NuevoAlmuerzoInvitado,
  ResumenAlmuerzosInvitados,
  TarifasAlmuerzosInvitados,
} from '../types/api';

/** GET /api/almuerzos-invitados/tarifas: precio por tipo y máximo de personas (fijados en el backend). */
export const useTarifasAlmuerzosInvitados = () =>
  useQuery({
    queryKey: queryKeys.tarifasAlmuerzosInvitados,
    queryFn: async () => (await apiClient.get<TarifasAlmuerzosInvitados>('/almuerzos-invitados/tarifas')).data,
    staleTime: Infinity,
  });

/** El filtro de tipo solo viaja si se eligió uno. */
const paramsDe = ({ desde, hasta, tipo }: FiltrosAlmuerzosInvitados) => (tipo ? { desde, hasta, tipo } : { desde, hasta });

/** GET /api/almuerzos-invitados?desde=&hasta=&tipo=: historial del período, el más reciente primero. */
export const useHistorialAlmuerzosInvitados = (filtros: FiltrosAlmuerzosInvitados, enabled = true) =>
  useQuery({
    queryKey: queryKeys.historialAlmuerzosInvitados(filtros),
    queryFn: async () =>
      (await apiClient.get<AlmuerzoInvitado[]>('/almuerzos-invitados', { params: paramsDe(filtros) })).data,
    placeholderData: keepPreviousData,
    enabled,
    ...EN_VIVO,
  });

/** GET /api/almuerzos-invitados/resumen?desde=&hasta=: personas y pesos de hoy y del período. */
export const useResumenAlmuerzosInvitados = (filtros: Omit<FiltrosAlmuerzosInvitados, 'tipo'>, enabled = true) =>
  useQuery({
    queryKey: queryKeys.resumenAlmuerzosInvitados(filtros),
    queryFn: async () =>
      (
        await apiClient.get<ResumenAlmuerzosInvitados>('/almuerzos-invitados/resumen', {
          params: { desde: filtros.desde, hasta: filtros.hasta },
        })
      ).data,
    placeholderData: keepPreviousData,
    enabled,
    ...EN_VIVO,
  });

/** Un cambio en los registros mueve el módulo, el reporte de Ventas y el encabezado del panel. */
const useRefrescarAlmuerzosInvitados = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.almuerzosInvitados });
    queryClient.invalidateQueries({ queryKey: queryKeys.ventas });
    queryClient.invalidateQueries({ queryKey: queryKeys.resumenEncargado });
  };
};

/** POST /api/almuerzos-invitados: el backend fija el precio con la tarifa vigente. */
export const useRegistrarAlmuerzoInvitado = () => {
  const refrescar = useRefrescarAlmuerzosInvitados();
  return useMutation({
    mutationFn: async (registro: NuevoAlmuerzoInvitado) =>
      (await apiClient.post<AlmuerzoInvitado>('/almuerzos-invitados', registro)).data,
    onSuccess: refrescar,
  });
};

/** PUT /api/almuerzos-invitados/:id: personas, nombre y fecha; el precio guardado no cambia. */
export const useEditarAlmuerzoInvitado = () => {
  const refrescar = useRefrescarAlmuerzosInvitados();
  return useMutation({
    mutationFn: async ({ id, cambios }: { id: string; cambios: CambiosAlmuerzoInvitado }) =>
      (await apiClient.put<AlmuerzoInvitado>(`/almuerzos-invitados/${id}`, cambios)).data,
    onSuccess: refrescar,
  });
};

/** DELETE /api/almuerzos-invitados/:id */
export const useEliminarAlmuerzoInvitado = () => {
  const refrescar = useRefrescarAlmuerzosInvitados();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<{ message: string }>(`/almuerzos-invitados/${id}`)).data,
    onSuccess: refrescar,
  });
};
