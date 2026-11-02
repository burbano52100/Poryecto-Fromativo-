import { z } from 'zod';
import { AppError } from '../middleware/error.middleware.js';

const uuidSchema = z.string().uuid('El identificador no es válido.');

/** Valida que un parámetro de ruta sea un UUID; responde 400 si no lo es. */
export const parseId = (id: unknown, mensaje = 'El identificador no es válido.'): string => {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) throw new AppError(mensaje, 400);
  return parsed.data;
};
