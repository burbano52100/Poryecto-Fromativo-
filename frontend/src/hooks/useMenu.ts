import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { queryKeys } from './queryKeys';
import type { EstadoMenu, MenuActivo, MenuDia, NuevoMenu, ReservaCreada } from '../types/api';

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
 * POST /api/consumos/reservar. El precio lo fija el backend (beneficiario $0, aprendiz
 * $5.000, invitado $8.000); el frontend nunca envía montos.
 */
export const useReservarAlmuerzo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (menuId?: string) =>
      (await apiClient.post<ReservaCreada>('/consumos/reservar', menuId ? { menu_id: menuId } : {})).data,
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
