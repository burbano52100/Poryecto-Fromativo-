import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const updateProfileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  email: z.string().email('Correo electrónico inválido').optional(),
  ficha: z.string().optional(),
});

export const updatePerfil = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const data = updateProfileSchema.parse(req.body);

    if (data.email) {
      const emailCheck = await query(
        'SELECT id FROM usuarios WHERE email = $1 AND id != $2 LIMIT 1;',
        [data.email.trim(), userId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ message: 'El correo electrónico ya está en uso por otro usuario.' });
      }
    }

    let assignedFichaId: string | null = null;
    let assignedCodigoFicha: string | null = null;

    if (data.ficha) {
      const fichaRes = await query(
        'SELECT id, codigo_ficha FROM fichas WHERE codigo_ficha = $1 LIMIT 1;',
        [data.ficha.trim()]
      );
      if (fichaRes.rows.length > 0) {
        assignedFichaId = fichaRes.rows[0].id;
        assignedCodigoFicha = fichaRes.rows[0].codigo_ficha;
      }
    }

    const currentRes = await query(
      'SELECT nombre, email, ficha_id FROM usuarios WHERE id = $1;',
      [userId]
    );
    const currentUser = currentRes.rows[0];

    const newName = data.name ? data.name.trim() : currentUser.nombre;
    const newEmail = data.email ? data.email.trim() : currentUser.email;
    const newFichaId = assignedFichaId || currentUser.ficha_id;

    const updateRes = await query(
      `WITH actualizado AS (
         UPDATE usuarios
         SET nombre = $1, email = $2, ficha_id = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING id, nombre, cedula, email, rol, activo, es_beneficiario, ficha_id
       )
       SELECT a.id, a.nombre as name, a.cedula as document, a.email, a.rol as role, a.activo,
              a.es_beneficiario, f.codigo_ficha
       FROM actualizado a
       LEFT JOIN fichas f ON f.id = a.ficha_id;`,
      [newName, newEmail, newFichaId, userId]
    );

    const updated = updateRes.rows[0];

    return res.json({
      message: '¡Perfil actualizado con éxito!',
      user: {
        id: updated.id,
        document: updated.document,
        name: updated.name,
        role: updated.role,
        email: updated.email || '',
        ficha: assignedCodigoFicha || updated.codigo_ficha || undefined,
        status: updated.activo ? 'ACTIVE' : 'INACTIVE',
        es_beneficiario: Boolean(updated.es_beneficiario),
      },
    });
  } catch (error) {
    next(error);
  }
};
