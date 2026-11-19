/**
 * Tarifas de "Almuerzos Invitados" (ADR 016). Este es el ÚNICO lugar donde se definen:
 * el backend cobra con ellas al registrar y el frontend las lee de
 * GET /api/almuerzos-invitados/tarifas.
 *
 * Cada registro guarda su precio_unitario, así que cambiar un valor aquí solo afecta
 * los registros nuevos; el histórico conserva el precio con el que se vendió.
 */
export const TIPOS_ALMUERZO_INVITADO = ['instructor', 'aprendiz', 'corriente'] as const;

export type TipoAlmuerzoInvitado = (typeof TIPOS_ALMUERZO_INVITADO)[number];

/** Precio por persona, en pesos colombianos. */
export const TARIFAS_ALMUERZO_INVITADO: Record<TipoAlmuerzoInvitado, number> = {
  instructor: 10000,
  aprendiz: 5000,
  corriente: 11000,
};

/** Máximo de personas en un solo registro: frena errores de digitación (4000 en vez de 40). */
export const MAX_PERSONAS_POR_REGISTRO = 500;
