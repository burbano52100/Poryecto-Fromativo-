import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'No autenticado: Se requiere inicio de sesión válido.',
      });
    }

    const userRole = req.user.role.toLowerCase();
    const hasRole = allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!hasRole) {
      return res.status(403).json({
        message: `Acceso denegado: Esta acción requiere uno de los siguientes roles: [${allowedRoles.join(
          ', '
        )}]. Tu rol actual es '${req.user.role}'.`,
      });
    }

    next();
  };
};
