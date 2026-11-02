import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { parseId } from '../utils/validacion.js';

/**
 * GET /api/beneficiarios/estudiantes
 * Retorna todos los aprendices registrados con su ficha y estado de beneficiario.
 * Acceso: encargado
 */
export const getEstudiantes = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT u.id,
              u.nombre as name,
              u.cedula as document,
              u.email,
              u.es_beneficiario,
              COALESCE(f.codigo_ficha, '') as ficha,
              u.activo,
              u.created_at
       FROM usuarios u
       LEFT JOIN fichas f ON u.ficha_id = f.id
       WHERE u.rol = 'aprendiz'
       ORDER BY u.nombre ASC;`
    );

    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/beneficiarios
 * Retorna únicamente los aprendices que actualmente tienen el beneficio de almuerzo gratis.
 * Acceso: encargado
 */
export const getBeneficiarios = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT u.id,
              u.nombre as name,
              u.cedula as document,
              u.email,
              u.es_beneficiario,
              COALESCE(f.codigo_ficha, '') as ficha,
              u.activo,
              u.created_at
       FROM usuarios u
       LEFT JOIN fichas f ON u.ficha_id = f.id
       WHERE u.rol = 'aprendiz' AND u.es_beneficiario = true
       ORDER BY u.nombre ASC;`
    );

    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/beneficiarios/:usuarioId
 * Asigna o revoca el beneficio de almuerzo a $0 para un aprendiz.
 * Acceso: encargado
 */
const toggleSchema = z.object({
  es_beneficiario: z.boolean({ message: "El campo 'es_beneficiario' debe ser booleano (true o false)." }),
});

export const toggleBeneficiario = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const usuarioId = parseId(req.params.usuarioId, 'El identificador del aprendiz no es válido.');
    const parsed = toggleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "El campo 'es_beneficiario' debe ser booleano (true o false)." });
    }
    const { es_beneficiario } = parsed.data;

    const updateRes = await query(
      `UPDATE usuarios
       SET es_beneficiario = $1,
           updated_at = NOW()
       WHERE id = $2 AND rol = 'aprendiz'
       RETURNING id, nombre as name, cedula as document, es_beneficiario;`,
      [es_beneficiario, usuarioId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ message: 'Aprendiz no encontrado o el usuario no tiene rol aprendiz.' });
    }

    return res.json({
      message: es_beneficiario
        ? `Se asignó el beneficio de almuerzo gratis ($0) a ${updateRes.rows[0].name}.`
        : `Se revocó el beneficio de almuerzo a ${updateRes.rows[0].name}.`,
      aprendiz: updateRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};
