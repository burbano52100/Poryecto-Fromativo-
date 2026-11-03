import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { EN_VIVO, queryKeys } from './queryKeys';
import type { PeriodoVentas, ReporteVentas, ResumenEncargado } from '../types/api';

/** GET /api/ventas?period=: reporte del Encargado por período en curso. */
export const useReporteVentas = (periodo: PeriodoVentas) =>
  useQuery({
    queryKey: queryKeys.ventasPorPeriodo(periodo),
    queryFn: async () => (await apiClient.get<ReporteVentas>('/ventas', { params: { period: periodo } })).data,
    placeholderData: keepPreviousData,
    ...EN_VIVO,
  });

/** GET /api/dashboard/encargado: indicadores de hoy del encabezado y del Sidebar del Encargado. */
export const useResumenEncargado = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.resumenEncargado,
    queryFn: async () => (await apiClient.get<ResumenEncargado>('/dashboard/encargado')).data,
    enabled,
    ...EN_VIVO,
  });
