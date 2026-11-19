import { z } from 'zod';

/** Máximo de caracteres de la institución y del responsable (igual que en el backend). */
export const MAX_NOMBRE_VISITA = 150;

/** Texto libre obligatorio: sin espacios al inicio ni al final, no vacío y de máximo 150 caracteres. */
const nombre = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, `${campo} es obligatorio.`)
    .max(MAX_NOMBRE_VISITA, `${campo} no puede superar ${MAX_NOMBRE_VISITA} caracteres.`);

/** Institución y responsable de una visita institucional, escritos a mano por el encargado. */
export const nombresVisitaSchema = z.object({
  institucionNombre: nombre('El nombre de la institución'),
  responsableNombre: nombre('El nombre del responsable'),
});

export type NombresVisita = z.infer<typeof nombresVisitaSchema>;
export type ErroresNombresVisita = Partial<Record<keyof NombresVisita, string>>;
