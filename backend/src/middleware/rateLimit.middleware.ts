import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 intentos fallidos por ventana
  // Solo cuentan los fallidos: en el SENA muchos aprendices comparten la IP pública del wifi
  // y no deben bloquearse entre sí por iniciar sesión correctamente
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos fallidos de inicio de sesión. Por favor espera 15 minutos.' },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
  message: { message: 'Demasiados intentos de registro. Intente más tarde.' },
});

/**
 * Comprobantes de pago con QR (ADR 027): cada lectura con OCR cuesta ~1 s de CPU. Se cuenta por usuario
 * (la ruta exige sesión), no por IP: en el SENA muchos comparten la IP del wifi.
 */
export const comprobanteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as { user?: { id?: string } }).user?.id ?? 'sin-sesion',
  skip: (_req) => process.env.NODE_ENV === 'test',
  message: { message: 'Subiste demasiados comprobantes seguidos. Espera unos minutos e inténtalo de nuevo.' },
});
