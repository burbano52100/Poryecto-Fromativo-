import type { FiltrosKardex, PeriodoVentas } from '../types/api';

/**
 * Claves de React Query centralizadas. Invalidar una clave invalida también las que
 * empiezan igual (p. ej. ['consumos'] refresca ['consumos', 'resumen']).
 */
export const queryKeys = {
  menu: ['menu'] as const,
  menuActivo: ['menu', 'activo'] as const,
  menus: ['menu', 'historial'] as const,
  consumos: ['consumos'] as const,
  resumenConsumos: ['consumos', 'resumen'] as const,
  miCuenta: ['deudas', 'mi-cuenta'] as const,
  cartera: ['deudas', 'cartera'] as const,
  ventas: ['ventas'] as const,
  ventasPorPeriodo: (periodo: PeriodoVentas) => ['ventas', periodo] as const,
  resumenEncargado: ['dashboard', 'encargado'] as const,
  grupos: ['grupos'] as const,
  aprendicesDeGrupo: (grupoId: string) => ['grupos', grupoId, 'aprendices'] as const,
  sugerencias: ['sugerencias'] as const,
  estudiantes: ['beneficiarios', 'estudiantes'] as const,
  inventario: ['inventario'] as const,
  materiales: ['inventario', 'materiales'] as const,
  recetas: ['inventario', 'recetas'] as const,
  kardex: (filtros: FiltrosKardex) => ['inventario', 'kardex', filtros] as const,
  mermas: ['inventario', 'mermas'] as const,
};

/** Datos que el Encargado sigue en vivo: se refrescan solos mientras el panel está abierto. */
export const EN_VIVO = {
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
} as const;
