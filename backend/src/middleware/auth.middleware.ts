import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tokenDelHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  return authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

/**
 * Usuario vigente del token: debe existir y seguir activo en la base de datos.
 * Los datos (incluido el rol) salen de la base y no del token, así que desactivar una
 * cuenta o cambiarle el rol tiene efecto inmediato aunque su token aún no venza (ADR 014).
 */
const usuarioVigente = async (id: unknown): Promise<AuthenticatedUser | null> => {
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  const res = await query(
    `SELECT id, cedula, nombre, rol, email, ficha_id
     FROM usuarios
     WHERE id = $1 AND activo = true;`,
    [id]
  );
  const u = res.rows[0];
  if (!u) return null;
  return {
    id: u.id,
    document: u.cedula,
    name: u.nombre,
    role: u.rol,
    email: u.email ?? undefined,
    ficha_id: u.ficha_id ?? undefined,
  };
};

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = tokenDelHeader(req);
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

  let decoded: AuthenticatedUser;
  try {
    decoded = jwt.verify(token, jwtSecret) as AuthenticatedUser;
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

  try {
    const user = await usuarioVigente(decoded.id);
    if (!user) {
      return res.status(401).json({
        message: 'Tu cuenta no existe o fue desactivada. Inicia sesión nuevamente.',
      });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/** Como authenticateToken, pero sin token (o con uno no vigente) continúa como anónimo. */
export const optionalAuthenticateToken = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  const token = tokenDelHeader(req);
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) return next();

  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthenticatedUser;
    req.user = (await usuarioVigente(decoded.id)) ?? undefined;
  } catch {
    // Token inválido o vencido: se atiende como anónimo
  }
  next();
};
