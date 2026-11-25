import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { EN_VIVO, queryKeys } from './queryKeys';
import type { ComprobantePago, EstadoComprobante, ResultadoComprobante, ResumenComprobantes } from '../types/api';

/** Pago con el código QR y comprobantes (ADR 027). */
const claves = {
  comprobantes: ['comprobantes'] as const,
  lista: (estado: EstadoComprobante | 'todos') => ['comprobantes', 'lista', estado] as const,
  resumen: ['comprobantes', 'resumen'] as const,
};

/** POST /api/consumos/:id/comprobante: sube la captura (el cuerpo es la imagen) y la lee con OCR. */
export const useSubirComprobante = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ventaId, archivo }: { ventaId: string; archivo: File }) =>
      (
        await apiClient.post<ResultadoComprobante>(`/consumos/${ventaId}/comprobante`, archivo, {
          headers: { 'Content-Type': archivo.type },
          timeout: 60_000,
        })
      ).data,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menuActivo });
      queryClient.invalidateQueries({ queryKey: queryKeys.consumos });
    },
  });
};

/** POST /api/consumos/:id/cancelar: libera la porción apartada. */
export const useCancelarReserva = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ventaId: string) =>
      (await apiClient.post<{ message: string }>(`/consumos/${ventaId}/cancelar`)).data,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menuActivo });
      queryClient.invalidateQueries({ queryKey: queryKeys.consumos });
    },
  });
};

/** GET /api/comprobantes (encargado). */
export const useComprobantes = (estado: EstadoComprobante | 'todos' = 'todos') =>
  useQuery({
    queryKey: claves.lista(estado),
    queryFn: async () =>
      (await apiClient.get<ComprobantePago[]>('/comprobantes', { params: estado === 'todos' ? {} : { estado } })).data,
    ...EN_VIVO,
  });

/** GET /api/comprobantes/resumen (encargado). `activo` en false no consulta (otros roles). */
export const useResumenComprobantes = (activo = true) =>
  useQuery({
    queryKey: claves.resumen,
    queryFn: async () => (await apiClient.get<ResumenComprobantes>('/comprobantes/resumen')).data,
    enabled: activo,
    ...EN_VIVO,
  });

/** GET /api/comprobantes/:id/imagen (encargado): la captura como URL local del navegador. */
export const useImagenComprobante = (id: string, activo: boolean) =>
  useQuery({
    queryKey: ['comprobantes', 'imagen', id],
    queryFn: async () =>
      URL.createObjectURL((await apiClient.get<Blob>(`/comprobantes/${id}/imagen`, { responseType: 'blob' })).data),
    enabled: activo,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });

const useRevision = (accion: 'aprobar' | 'rechazar') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) =>
      (await apiClient.post<{ message: string }>(`/comprobantes/${id}/${accion}`, motivo ? { motivo } : {})).data,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: claves.comprobantes });
      queryClient.invalidateQueries({ queryKey: queryKeys.ventas });
      queryClient.invalidateQueries({ queryKey: queryKeys.grupos });
    },
  });
};

export const useAprobarComprobante = () => useRevision('aprobar');
export const useRechazarComprobante = () => useRevision('rechazar');
