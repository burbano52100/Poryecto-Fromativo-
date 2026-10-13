import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // 1. Error de validación Zod
  if (err instanceof ZodError) {
    const messages = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return res.status(400).json({
      message: `Error de validación: ${messages}`,
      errors: err.issues,
    });
  }

  // 2. Errores personalizados de la aplicación
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  // 3. Códigos de error de PostgreSQL
  if (err && err.code) {
    // 23505: Unique violation
    if (err.code === '23505') {
      const detail = err.detail || '';
      let friendly = 'Ya existe un registro con estos datos únicos.';
      if (detail.includes('cedula')) friendly = 'El número de cédula o documento ya está registrado.';
      if (detail.includes('email')) friendly = 'El correo electrónico ya se encuentra registrado.';
      if (detail.includes('codigo_ficha')) friendly = 'El código de ficha ya está registrado.';
      if (detail.includes('codigo_barras')) friendly = 'El código de barras ya está registrado.';
      return res.status(409).json({ message: friendly });
    }

    // 23503: Foreign key violation
    if (err.code === '23503') {
      return res.status(400).json({
        message: 'La referencia relacionada no existe o no es válida.',
        detail: err.detail,
      });
    }

    // 23514: Check constraint violation
    if (err.code === '23514') {
      return res.status(400).json({
        message: 'Los datos no cumplen las restricciones del sistema.',
        detail: err.constraint,
      });
    }
  }

  console.error('[Global Error]', err);

  const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const message =
    status === 500 && process.env.NODE_ENV === 'production'
      ? 'Error interno en el servidor. Inténtalo de nuevo más tarde.'
      : err.message || 'Error interno inesperado.';

  return res.status(status).json({ message });
};
