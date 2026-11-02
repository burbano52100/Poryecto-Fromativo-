import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { queryKeys } from './queryKeys';
import type {
  FiltrosKardex,
  Material,
  Merma,
  NuevaMerma,
  NuevaReceta,
  NuevoMaterial,
  PaginaKardex,
  Receta,
} from '../types/api';

export const useMateriales = () =>
  useQuery({
    queryKey: queryKeys.materiales,
    queryFn: async () => (await apiClient.get<Material[]>('/inventario/materiales')).data,
  });

export const useRecetas = () =>
  useQuery({
    queryKey: queryKeys.recetas,
    queryFn: async () => (await apiClient.get<Receta[]>('/inventario/recetas')).data,
  });

export const useKardex = (filtros: FiltrosKardex) =>
  useQuery({
    queryKey: queryKeys.kardex(filtros),
    queryFn: async () =>
      (await apiClient.get<PaginaKardex>('/inventario/kardex', { params: { ...filtros, limit: 100 } })).data,
  });

export const useMermas = () =>
  useQuery({
    queryKey: queryKeys.mermas,
    queryFn: async () => (await apiClient.get<Merma[]>('/inventario/mermas')).data,
  });

/**
 * Cualquier cambio de inventario mueve stock, kardex y a veces el costo de las recetas,
 * así que se invalida todo el módulo.
 */
const useMutacionInventario = <TVariables,>(mutationFn: (variables: TVariables) => Promise<unknown>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventario }),
  });
};

export const useCrearMaterial = () =>
  useMutacionInventario(async (material: NuevoMaterial) => (await apiClient.post('/inventario/materiales', material)).data);

export const useEliminarMaterial = () =>
  useMutacionInventario(async (id: string) => (await apiClient.delete(`/inventario/materiales/${id}`)).data);

export const useRegistrarEntrada = () =>
  useMutacionInventario(
    async ({ id, cantidad, costo_unitario }: { id: string; cantidad: number; costo_unitario?: number }) =>
      (await apiClient.post(`/inventario/materiales/${id}/entradas`, { cantidad, costo_unitario })).data
  );

export const useRegistrarSalida = () =>
  useMutacionInventario(
    async ({ id, cantidad, concepto }: { id: string; cantidad: number; concepto: string }) =>
      (await apiClient.post(`/inventario/materiales/${id}/salidas`, { cantidad, concepto })).data
  );

export const useCrearReceta = () =>
  useMutacionInventario(async (receta: NuevaReceta) => (await apiClient.post('/inventario/recetas', receta)).data);

export const useActualizarReceta = () =>
  useMutacionInventario(async ({ id, receta }: { id: string; receta: NuevaReceta }) =>
    (await apiClient.put(`/inventario/recetas/${id}`, receta)).data
  );

export const useRegistrarMerma = () =>
  useMutacionInventario(async (merma: NuevaMerma) => (await apiClient.post('/inventario/mermas', merma)).data);
