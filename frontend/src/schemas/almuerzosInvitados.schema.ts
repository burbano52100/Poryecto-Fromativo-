import { z } from 'zod';
import type { TipoAlmuerzoInvitado } from '../types/api';
import { ahoraBogotaLocal } from '../lib/formato';

/**
 * Almuerzos Invitados (ADR 016). Las tarifas y el máximo de personas NO están aquí: los fija
 * el backend (backend/src/config/almuerzosInvitados.ts) y llegan por GET /tarifas.
 * Estas validaciones repiten las del servidor para avisar antes de enviar.
 */
export const TIPOS_ALMUERZO_INVITADO = ['instructor', 'aprendiz', 'corriente'] as const satisfies readonly TipoAlmuerzoInvitado[];

export const ETIQUETA_TIPO_INVITADO: Record<TipoAlmuerzoInvitado, { titulo: string; corto: string }> = {
  instructor: { titulo: 'Almuerzos invitados de instructores', corto: 'Instructores' },
  aprendiz: { titulo: 'Almuerzos invitados de aprendices', corto: 'Aprendices' },
  corriente: { titulo: 'Almuerzos invitados corrientes', corto: 'Corrientes' },
};

export const tipoInvitadoSchema = z.enum(TIPOS_ALMUERZO_INVITADO, {
  error: 'El tipo de almuerzo no es válido. Usa: instructor, aprendiz o corriente.',
});

/** Número de personas: entero entre 1 y `max`. El campo es texto (solo dígitos) y sale como número. */
const personasSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Ingresa el número de personas.')
    .regex(/^\d+$/, 'El número de personas debe ser un número entero.')
    .transform(Number)
    .refine((n) => n >= 1, 'El número de personas debe ser mayor a 0.')
    .refine((n) => n <= max, `El número de personas no puede superar ${max} por registro.`);

const nombreSchema = z
  .string()
  .trim()
  .max(120, 'El nombre o nota no puede superar 120 caracteres.')
  .transform((nombre) => nombre || null);

export const crearRegistroInvitadoSchema = (maxPersonas: number) =>
  z.object({
    tipo: tipoInvitadoSchema,
    personas: personasSchema(maxPersonas),
    nombre: nombreSchema,
  });

export const crearEdicionInvitadoSchema = (maxPersonas: number) =>
  z.object({
    personas: personasSchema(maxPersonas),
    nombre: nombreSchema,
    fechaHora: z
      .string()
      .min(1, 'La fecha y hora es obligatoria.')
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'La fecha y hora no es válida.')
      .refine((valor) => valor <= ahoraBogotaLocal(), 'La fecha y hora no puede ser futura.'),
  });

export type RegistroInvitadoForm = z.input<ReturnType<typeof crearRegistroInvitadoSchema>>;
export type RegistroInvitadoData = z.output<ReturnType<typeof crearRegistroInvitadoSchema>>;
export type EdicionInvitadoForm = z.input<ReturnType<typeof crearEdicionInvitadoSchema>>;
export type EdicionInvitadoData = z.output<ReturnType<typeof crearEdicionInvitadoSchema>>;

/** Personas válidas escritas en el campo (0 si aún no es un entero), para el total en vivo. */
export const personasEscritas = (valor: string | undefined): number => (/^\d+$/.test(valor?.trim() ?? '') ? Number(valor) : 0);

/** "1 persona" / "4 personas" */
export const textoPersonas = (n: number): string => `${n} persona${n === 1 ? '' : 's'}`;
