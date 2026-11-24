import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { queryKeys } from './queryKeys';
import type { AlmuerzoEspecial, NuevoAlmuerzoEspecial, ResumenAlmuerzosEspeciales } from '../types/api';

/** GET /api/almuerzos-especiales: todos los pedidos, del más reciente al más antiguo. */
export const useAlmuerzosEspeciales = () =>
  useQuery({
    queryKey: queryKeys.almuerzosEspeciales,
    queryFn: async () => (await apiClient.get<AlmuerzoEspecial[]>('/almuerzos-especiales')).data,
  });

/** GET /api/almuerzos-especiales/resumen: por cobrar a contratos, programados y cobrado en el mes. */
export const useResumenAlmuerzosEspeciales = () =>
  useQuery({
    queryKey: queryKeys.resumenAlmuerzosEspeciales,
    queryFn: async () => (await apiClient.get<ResumenAlmuerzosEspeciales>('/almuerzos-especiales/resumen')).data,
  });

/**
 * Un cambio de estado mueve la sección y, según el caso, la bodega (al entregar) o Ventas y el
 * encabezado del panel (al pagar). Se refresca todo: son pocas consultas.
 */
const useRefrescar = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.almuerzosEspeciales });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventario });
    queryClient.invalidateQueries({ queryKey: queryKeys.ventas });
    queryClient.invalidateQueries({ queryKey: queryKeys.resumenEncargado });
  };
};

/** POST /api/almuerzos-especiales: el pedido queda programado y sin pagar. */
export const useCrearAlmuerzoEspecial = () => {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async (pedido: NuevoAlmuerzoEspecial) =>
      (await apiClient.post<AlmuerzoEspecial>('/almuerzos-especiales', pedido)).data,
    onSuccess: refrescar,
  });
};

type Accion = 'entregado' | 'pagado' | 'cancelado';

/** PATCH /api/almuerzos-especiales/:id/{entregado|pagado|cancelado}. */
export const useCambiarAlmuerzoEspecial = () => {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async ({ id, accion }: { id: string; accion: Accion }) =>
      (await apiClient.patch<AlmuerzoEspecial>(`/almuerzos-especiales/${id}/${accion}`)).data,
    onSuccess: refrescar,
  });
};
