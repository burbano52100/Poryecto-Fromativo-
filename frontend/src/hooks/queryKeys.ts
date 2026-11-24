import type { FiltrosAlmuerzosInvitados, FiltrosKardex, FiltrosUsuarios, PeriodoVentas } from '../types/api';

/**
 * Claves de React Query centralizadas. Invalidar una clave invalida también las que
 * empiezan igual (p. ej. ['consumos'] refresca ['consumos', 'resumen']).
 */
export const queryKeys = {
  menu: ['menu'] as const,
  menuActivo: ['menu', 'activo'] as const,
  menus: ['menu', 'historial'] as const,
  recetasParaMenu: ['menu', 'recetas'] as const,
  sugerenciaPreparacion: (fecha: string) => ['menu', 'sugerencia', fecha] as const,
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
  almuerzosEspeciales: ['almuerzos-especiales'] as const,
  resumenAlmuerzosEspeciales: ['almuerzos-especiales', 'resumen'] as const,
  almuerzosInvitados: ['almuerzos-invitados'] as const,
  tarifasAlmuerzosInvitados: ['almuerzos-invitados', 'tarifas'] as const,
  historialAlmuerzosInvitados: (filtros: FiltrosAlmuerzosInvitados) => ['almuerzos-invitados', 'historial', filtros] as const,
  resumenAlmuerzosInvitados: (filtros: FiltrosAlmuerzosInvitados) => ['almuerzos-invitados', 'resumen', filtros] as const,
  // Coordinador (ADR 018): invalidar ['coordinador'] refresca resumen, solicitudes, usuarios y fichas
  coordinador: ['coordinador'] as const,
  resumenCoordinador: ['coordinador', 'resumen'] as const,
  solicitudesCoordinador: (q: string) => ['coordinador', 'solicitudes', q] as const,
  usuariosCoordinador: (filtros: FiltrosUsuarios) => ['coordinador', 'usuarios', filtros] as const,
  fichasCoordinador: ['coordinador', 'fichas'] as const,
  cargasMasivas: ['coordinador', 'cargas'] as const,
};

/** Datos que el Encargado sigue en vivo: se refrescan solos mientras el panel está abierto. */
export const EN_VIVO = {
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
} as const;
