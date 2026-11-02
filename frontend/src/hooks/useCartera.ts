import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { EN_VIVO, queryKeys } from './queryKeys';
import type { Deuda, MiCuenta, PagoDeudaRespuesta } from '../types/api';

/** GET /api/deudas: cartera de deudas pendientes (Encargado). */
export const useCartera = () =>
  useQuery({
    queryKey: queryKeys.cartera,
    queryFn: async () => (await apiClient.get<Deuda[]>('/deudas')).data,
    ...EN_VIVO,
  });

/** GET /api/deudas/mi-cuenta: saldo y consumo mensual del instructor. */
export const useMiCuenta = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.miCuenta,
    queryFn: async () => (await apiClient.get<MiCuenta>('/deudas/mi-cuenta')).data,
    enabled,
  });

/** POST /api/deudas/:id/pagar. Sin monto, paga el total. */
export const usePagarDeuda = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, monto }: { id: string; monto?: number }) =>
      (await apiClient.post<PagoDeudaRespuesta>(`/deudas/${id}/pagar`, monto ? { monto } : {})).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartera });
      queryClient.invalidateQueries({ queryKey: queryKeys.resumenEncargado });
      queryClient.invalidateQueries({ queryKey: queryKeys.ventas });
    },
  });
};
