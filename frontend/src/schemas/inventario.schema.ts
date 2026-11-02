import { z } from 'zod';

/**
 * Validaciones de los formularios de inventario. Coinciden con las del backend:
 * stock y movimientos con hasta 2 decimales, ingredientes de receta con hasta 3.
 */
const decimales = (maximo: number) => (valor: number) => {
  const escalado = valor * 10 ** maximo;
  return Math.abs(escalado - Math.round(escalado)) < 1e-9;
};

const numero = (mensaje: string) =>
  z
    .string()
    .trim()
    .min(1, mensaje)
    .transform(Number)
    .refine((n) => Number.isFinite(n), 'Debe ser un número');

const cantidad = (maxDecimales: number) =>
  numero('Ingresa la cantidad')
    .refine((n) => n > 0, 'La cantidad debe ser mayor a 0')
    .refine(decimales(maxDecimales), `Máximo ${maxDecimales} decimales`);

const montoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : Number(v)))
  .refine((n) => n === undefined || (Number.isFinite(n) && n >= 0), 'Debe ser un valor positivo');

export const materialSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio (mínimo 2 caracteres)'),
  code: z.string().trim().optional(),
  category: z.string().trim().min(1, 'La categoría es obligatoria'),
  unit: z.string().trim().min(1, 'La unidad es obligatoria'),
  expiry: z.string().optional(),
  stock: numero('Ingresa el stock inicial')
    .refine((n) => n >= 0, 'No puede ser negativo')
    .refine(decimales(2), 'Máximo 2 decimales'),
  stock_minimo: numero('Ingresa el stock mínimo').refine((n) => n >= 0, 'No puede ser negativo'),
  costo_unitario: numero('Ingresa el costo unitario').refine((n) => n >= 0, 'No puede ser negativo'),
});

export const entradaSchema = z.object({
  cantidad: cantidad(2),
  costo_unitario: montoOpcional,
});

export const salidaSchema = z.object({
  cantidad: cantidad(2),
  concepto: z.string().trim().min(3, 'Indica el concepto (mínimo 3 caracteres)'),
});

export const mermaSchema = z.object({
  material_id: z.string().min(1, 'Selecciona el material'),
  quantity: cantidad(2),
  reason: z.string().trim().min(3, 'Indica la razón (mínimo 3 caracteres)'),
});

export const recetaSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio'),
  code: z.string().trim().optional(),
  price: numero('Ingresa el precio de venta').refine((n) => n >= 0, 'No puede ser negativo'),
  ingredients: z
    .array(z.object({ material_id: z.string().min(1, 'Selecciona el material'), cantidad: cantidad(3) }))
    .min(1, 'Agrega al menos un ingrediente')
    .refine((items) => new Set(items.map((i) => i.material_id)).size === items.length, 'Un material no puede repetirse'),
});

export type MaterialForm = z.input<typeof materialSchema>;
export type MaterialData = z.output<typeof materialSchema>;
export type EntradaForm = z.input<typeof entradaSchema>;
export type EntradaData = z.output<typeof entradaSchema>;
export type SalidaForm = z.input<typeof salidaSchema>;
export type SalidaData = z.output<typeof salidaSchema>;
export type MermaForm = z.input<typeof mermaSchema>;
export type MermaData = z.output<typeof mermaSchema>;
export type RecetaForm = z.input<typeof recetaSchema>;
export type RecetaData = z.output<typeof recetaSchema>;
