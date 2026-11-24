import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { queryKeys } from './queryKeys';
import type {
  EstadoMenu,
  FormaPago,
  MenuActivo,
  MenuDia,
  NuevoMenu,
  RecetaParaMenu,
  ReservaCreada,
  SugerenciaPreparacion,
} from '../types/api';

/** GET /api/menus/activo: menú de hoy con el precio y el estado de reserva del usuario. */
export const useMenuActivo = () =>
  useQuery({
    queryKey: queryKeys.menuActivo,
    queryFn: async () => (await apiClient.get<MenuActivo>('/menus/activo')).data,
    refetchInterval: 60_000,
  });

/** El menú por defecto que devuelve el backend cuando aún no hay uno publicado. */
export const esMenuPublicado = (menu: MenuActivo | undefined): menu is MenuActivo =>
  !!menu && menu.id !== 'default_menu';

/**
 * POST /api/consumos/reservar. El precio lo fija el backend (beneficiario $0; aprendiz e
 * instructor, el precio del menú); el frontend nunca envía montos.
 */
export const useReservarAlmuerzo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    // formaPago solo la envía el instructor (ADR 026): fiado a su cuenta o de contado en la ventanilla
    mutationFn: async ({ menuId, formaPago }: { menuId?: string; formaPago?: FormaPago } = {}) =>
      (
        await apiClient.post<ReservaCreada>('/consumos/reservar', {
          ...(menuId ? { menu_id: menuId } : {}),
          ...(formaPago ? { forma_pago: formaPago } : {}),
        })
      ).data,
    // También tras un error (cupo agotado, duplicada, fuera de horario) para mostrar el estado real
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menuActivo });
      queryClient.invalidateQueries({ queryKey: queryKeys.consumos });
      queryClient.invalidateQueries({ queryKey: queryKeys.miCuenta });
    },
  });
};

/** GET /api/menus (Encargado): historial, el más reciente primero, en cualquier estado. */
export const useMenus = () =>
  useQuery({
    queryKey: queryKeys.menus,
    queryFn: async () => (await apiClient.get<MenuDia[]>('/menus')).data,
  });

/** GET /api/menus/recetas: recetas activas para asignar al menú (sus ingredientes se descuentan al vender). */
export const useRecetasParaMenu = () =>
  useQuery({
    queryKey: queryKeys.recetasParaMenu,
    queryFn: async () => (await apiClient.get<RecetaParaMenu[]>('/menus/recetas')).data,
  });

/** GET /api/menus/sugerencia?fecha=: cuántos almuerzos preparar según semanas anteriores. */
export const useSugerenciaPreparacion = (fecha: string) =>
  useQuery({
    queryKey: queryKeys.sugerenciaPreparacion(fecha),
    queryFn: async () => (await apiClient.get<SugerenciaPreparacion>('/menus/sugerencia', { params: { fecha } })).data,
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(fecha),
  });

export const usePublicarMenu = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (menu: NuevoMenu) => (await apiClient.post('/menus', menu)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.menu }),
  });
};

export const useCambiarEstadoMenu = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoMenu }) =>
      (await apiClient.patch(`/menus/${id}/estado`, { estado })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.menu }),
  });
};
