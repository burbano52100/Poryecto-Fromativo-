import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { EN_VIVO, queryKeys } from './queryKeys';
import type {
  CargaMasiva,
  CuentaGestionada,
  FichaCoordinador,
  FiltrosUsuarios,
  PaginaUsuarios,
  PrevisualizacionCarga,
  ResultadoCarga,
  ResumenCoordinador,
  TipoCarga,
} from '../types/api';

/** Endpoints de /api/coordinador (ADR 018): cuentas de instructores y aprendices, fichas y cargas masivas. */

type Mensaje = { message: string };

/** GET /api/coordinador/resumen: indicadores del encabezado y contador del Sidebar. */
export const useResumenCoordinador = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.resumenCoordinador,
    queryFn: async () => (await apiClient.get<ResumenCoordinador>('/coordinador/resumen')).data,
    enabled,
    ...EN_VIVO,
  });

/** GET /api/coordinador/solicitudes?q=: cuentas pendientes, la más antigua primero. */
export const useSolicitudesCoordinador = (q: string) =>
  useQuery({
    queryKey: queryKeys.solicitudesCoordinador(q),
    queryFn: async () =>
      (await apiClient.get<CuentaGestionada[]>('/coordinador/solicitudes', { params: q ? { q } : {} })).data,
    placeholderData: keepPreviousData,
    ...EN_VIVO,
  });

/** Tras cualquier cambio se refresca todo el módulo: resumen, solicitudes, usuarios y fichas. */
const useRefrescarCoordinador = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.coordinador });
};

export const useAprobarSolicitudes = () => {
  const refrescar = useRefrescarCoordinador();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      (await apiClient.post<Mensaje & { aprobadas: number }>('/coordinador/solicitudes/aprobar', { ids })).data,
    onSuccess: refrescar,
  });
};

export const useRechazarSolicitudes = () => {
  const refrescar = useRefrescarCoordinador();
  return useMutation({
    mutationFn: async ({ ids, motivo }: { ids: string[]; motivo: string }) =>
      (await apiClient.post<Mensaje & { rechazadas: number }>('/coordinador/solicitudes/rechazar', { ids, motivo })).data,
    onSuccess: refrescar,
  });
};

/** GET /api/coordinador/usuarios con filtros y paginación. */
export const useUsuariosCoordinador = (filtros: FiltrosUsuarios) =>
  useQuery({
    queryKey: queryKeys.usuariosCoordinador(filtros),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ''));
      return (await apiClient.get<PaginaUsuarios>('/coordinador/usuarios', { params })).data;
    },
    placeholderData: keepPreviousData,
  });

export const useCambiarEstadoUsuario = () => {
  const refrescar = useRefrescarCoordinador();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'activo' | 'inactivo' }) =>
      (await apiClient.patch<Mensaje>(`/coordinador/usuarios/${id}/estado`, { estado })).data,
    onSuccess: refrescar,
  });
};

export const useRestablecerClave = () => {
  const refrescar = useRefrescarCoordinador();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post<Mensaje>(`/coordinador/usuarios/${id}/restablecer-clave`)).data,
    onSuccess: refrescar,
  });
};

/** GET /api/coordinador/fichas */
export const useFichasCoordinador = () =>
  useQuery({
    queryKey: queryKeys.fichasCoordinador,
    queryFn: async () => (await apiClient.get<FichaCoordinador[]>('/coordinador/fichas')).data,
  });

export const useCambiarEstadoFicha = () => {
  const refrescar = useRefrescarCoordinador();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'activa' | 'finalizada' }) =>
      (await apiClient.patch<Mensaje>(`/coordinador/fichas/${id}/estado`, { estado })).data,
    onSuccess: refrescar,
  });
};

/** GET /api/coordinador/cargas: últimas 50 cargas masivas. */
export const useHistorialCargas = () =>
  useQuery({
    queryKey: queryKeys.cargasMasivas,
    queryFn: async () => (await apiClient.get<CargaMasiva[]>('/coordinador/cargas')).data,
  });

/** El archivo viaja como cuerpo binario y su nombre en X-Nombre-Archivo (sin multer en el backend). */
const enviarArchivo = async <T,>(url: string, archivo: File) =>
  (
    await apiClient.post<T>(url, archivo, {
      headers: { 'Content-Type': 'application/octet-stream', 'X-Nombre-Archivo': encodeURIComponent(archivo.name) },
      timeout: 120_000,
    })
  ).data;

/** Valida el archivo sin crear nada. */
export const usePrevisualizarCarga = () =>
  useMutation({
    mutationFn: ({ tipo, archivo }: { tipo: TipoCarga; archivo: File }) =>
      enviarArchivo<PrevisualizacionCarga>(`/coordinador/cargas/${tipo}/previsualizar`, archivo),
  });

/** Vuelve a validar el mismo archivo y crea las cuentas de las filas válidas. */
export const useConfirmarCarga = () => {
  const refrescar = useRefrescarCoordinador();
  return useMutation({
    mutationFn: ({ tipo, archivo }: { tipo: TipoCarga; archivo: File }) =>
      enviarArchivo<ResultadoCarga>(`/coordinador/cargas/${tipo}/confirmar`, archivo),
    onSuccess: refrescar,
  });
};
