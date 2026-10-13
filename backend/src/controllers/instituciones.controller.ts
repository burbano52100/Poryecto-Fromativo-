import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const getInstituciones = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT id, nombre, tipo, ciudad, activo FROM instituciones WHERE activo = true ORDER BY nombre ASC;'
    );
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const instSchema = z.object({
  nombre: z.string().min(3, 'El nombre de la institución es obligatorio'),
  tipo: z.enum(['colegio', 'universidad', 'empresa', 'otro']).default('colegio'),
  ciudad: z.string().default('Pitalito'),
});

export const createInstitucion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = instSchema.parse(req.body);
    const insertRes = await query(
      `INSERT INTO instituciones (nombre, tipo, ciudad, activo)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (nombre) DO UPDATE SET activo = true
       RETURNING id, nombre, tipo, ciudad, activo;`,
      [data.nombre.trim(), data.tipo, data.ciudad.trim()]
    );
    return res.status(201).json(insertRes.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const getInstructoresList = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT id, cedula as document, nombre as name, email
       FROM usuarios
       WHERE rol = 'instructor' AND activo = true
       ORDER BY nombre ASC;`
    );
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
