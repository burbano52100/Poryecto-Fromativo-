import { z } from 'zod';

/** Quién suele pedir almuerzos especiales, según el encargado del comedor. "Otra" abre un campo de texto. */
export const DEPENDENCIAS = ['Bienestar al Aprendiz', 'Regional Huila', 'Dirección General'] as const;
export const OTRA_DEPENDENCIA = 'Otra dependencia';

/** Opción del select para un pedido sin receta (React Aria no admite una clave vacía). */
export const SIN_RECETA = 'sin-receta';

/** Mismo tope que el backend: frena errores de digitación (1.500.000 en vez de 15.000). */
export const MAX_PRECIO_ESPECIAL = 500_000;
export const MAX_PERSONAS_ESPECIAL = 500;

const entero = (mensaje: string) =>
  z
    .string()
    .trim()
    .min(1, mensaje)
    .refine((v) => /^\d+$/.test(v), 'Escribe solo números, sin puntos ni comas');

export const almuerzoEspecialSchema = z
  .object({
    dependencia: z.string().min(1, 'Elige quién lo pide'),
    otraDependencia: z.string().trim().max(150, 'Máximo 150 caracteres'),
    responsable: z.string().trim().min(1, 'Escribe el nombre del responsable').max(150, 'Máximo 150 caracteres'),
    numeroContrato: z.string().trim().max(60, 'Máximo 60 caracteres'),
    fecha: z.string().min(1, 'Elige la fecha de entrega'),
    personas: entero('Escribe cuántas personas').refine(
      (v) => Number(v) > 0 && Number(v) <= MAX_PERSONAS_ESPECIAL,
      `Entre 1 y ${MAX_PERSONAS_ESPECIAL} personas`
    ),
    menu: z.string().trim().min(3, 'Describe qué se va a servir').max(500, 'Máximo 500 caracteres'),
    recetaId: z.string(),
    precio: entero('Escribe el precio por persona').refine(
      (v) => Number(v) > 0 && Number(v) <= MAX_PRECIO_ESPECIAL,
      'Revisa el precio por persona'
    ),
  })
  .refine((d) => d.dependencia !== OTRA_DEPENDENCIA || d.otraDependencia.length > 0, {
    path: ['otraDependencia'],
    message: 'Escribe el nombre de la dependencia',
  });

export type AlmuerzoEspecialForm = z.infer<typeof almuerzoEspecialSchema>;
