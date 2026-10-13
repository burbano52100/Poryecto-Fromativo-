import { Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const getGrupos = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT f.id, f.codigo_ficha as ficha, f.programa as program,
              f.cantidad_estudiantes as "studentsCount",
              COALESCE(f.vocero, 'Sin vocero asignado') as vocero,
              COALESCE(INITCAP(f.jornada), 'Mañana') as shift,
              u.nombre as instructor_nombre
       FROM fichas f
       LEFT JOIN usuarios u ON f.instructor_id = u.id
       ORDER BY f.codigo_ficha ASC;`
    );

    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getMisFichasInstructor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instructorId = req.user?.id;
    if (!instructorId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const result = await query(
      `SELECT f.id, f.codigo_ficha as ficha, f.programa as program,
              f.cantidad_estudiantes as "studentsCount",
              COALESCE(f.vocero, 'Sin vocero') as vocero,
              COALESCE(INITCAP(f.jornada), 'Mañana') as shift
       FROM fichas f
       WHERE f.instructor_id = $1
       ORDER BY f.codigo_ficha ASC;`,
      [instructorId]
    );

    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
