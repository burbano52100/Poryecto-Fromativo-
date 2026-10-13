import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // 15 intentos máximos por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Demasiados intentos fallidos de inicio de sesión. Por favor espera 15 minutos.',
  },
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 300, // 300 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
});
