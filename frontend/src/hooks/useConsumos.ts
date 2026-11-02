import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { queryKeys } from './queryKeys';
import type { Consumo, ResumenConsumos } from '../types/api';

/** GET /api/consumos: historial propio con estado Reservado/Consumido y de pago. */
export const useConsumos = () =>
  useQuery({
    queryKey: queryKeys.consumos,
    queryFn: async () => (await apiClient.get<Consumo[]>('/consumos')).data,
  });

/** GET /api/consumos/resumen: totales para las tarjetas del panel. */
export const useResumenConsumos = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.resumenConsumos,
    queryFn: async () => (await apiClient.get<ResumenConsumos>('/consumos/resumen')).data,
    enabled,
  });
