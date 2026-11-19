import { z } from 'zod';
import { AppError } from '../middleware/error.middleware.js';
import { esFechaValida, fechaBogota } from './horario.js';

/** 'YYYY-MM-DD' que existe en el calendario. */
export const fechaSchema = (campo: string) =>
  z
    .string({ error: `${campo} debe ser una fecha (AAAA-MM-DD).` })
    .refine(esFechaValida, `${campo} no es una fecha válida (AAAA-MM-DD).`);

/** Campos opcionales desde/hasta para mezclar en el esquema de filtros de cada endpoint. */
export const rangoCampos = {
  desde: fechaSchema('La fecha inicial').optional(),
  hasta: fechaSchema('La fecha final').optional(),
};

/** Resta días a una fecha 'YYYY-MM-DD' sin pasar por la zona horaria. */
export const restarDias = (fecha: string, dias: number): string => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia - dias)).toISOString().slice(0, 10);
};

/**
 * Completa el rango: sin `hasta` se usa hoy (Colombia); sin `desde`, `diasAtras` días antes de `hasta`.
 * Responde 400 si la fecha inicial es posterior a la final.
 */
export const resolverRango = (
  { desde, hasta }: { desde?: string; hasta?: string },
  diasAtras = 0
): { desde: string; hasta: string } => {
  const fin = hasta ?? fechaBogota();
  const inicio = desde ?? restarDias(fin, diasAtras);
  if (inicio > fin) throw new AppError('La fecha inicial no puede ser posterior a la fecha final.', 400);
  return { desde: inicio, hasta: fin };
};

/** Condición SQL: el instante `columna` cae entre el inicio del día `pDesde` y el final del día `pHasta` (Colombia). */
export const entreDiasBogota = (columna: string, pDesde: string, pHasta: string): string =>
  `${columna} >= (${pDesde}::date::timestamp AT TIME ZONE 'America/Bogota')
   AND ${columna} < ((${pHasta}::date + 1)::timestamp AT TIME ZONE 'America/Bogota')`;
