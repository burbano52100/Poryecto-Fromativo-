import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  document: string;
  name: string;
  role: 'aprendiz' | 'instructor' | 'encargado' | 'invitado';
  email?: string;
  ficha_id?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: 'No autenticado: Token de autorización ausente o inválido.',
    });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({
      message: 'Error de configuración del servidor: JWT_SECRET no definido.',
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Sesión expirada: Por favor inicia sesión nuevamente.',
        expired: true,
      });
    }
    return res.status(401).json({
      message: 'Token de sesión inválido o corrupto.',
    });
  }
};
