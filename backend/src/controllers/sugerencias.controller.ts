import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const getSugerencias = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const isEncargado = req.user?.role === 'encargado';
    const userId = req.user?.id;

    let sql = `
      SELECT s.id, s.asunto as subject, s.mensaje as message,
             s.fecha, s.estado, s.respuesta, s.atendida_en,
             u.nombre as author, u.rol as role, u.cedula,
             COALESCE(f.codigo_ficha, '') as codigo_ficha
      FROM sugerencias s
      LEFT JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN fichas f ON s.ficha_id = f.id
    `;

    const params: any[] = [];
    if (!isEncargado && userId) {
      sql += ' WHERE s.usuario_id = $1';
      params.push(userId);
    }

    sql += ' ORDER BY s.fecha DESC;';

    const result = await query(sql, params);

    const formatted = result.rows.map((row) => {
      const dateStr = new Date(row.fecha).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const roleDisplay = row.role
        ? row.role.charAt(0).toUpperCase() + row.role.slice(1)
        : 'Usuario';

      const fichaOrDoc = row.codigo_ficha
        ? `Ficha ${row.codigo_ficha}`
        : `C.C. ${row.cedula || 'N/A'}`;

      return {
        id: row.id,
        subject: row.subject,
        message: row.message,
        author: row.author || 'Anónimo',
        role: roleDisplay,
        fichaOrDoc,
        date: dateStr,
        status: (row.estado === 'atendida' ? 'ATENDIDA' : 'PENDIENTE') as 'ATENDIDA' | 'PENDIENTE',
        respuesta: row.respuesta || null,
      };
    });

    return res.json(formatted);
  } catch (error) {
    next(error);
  }
};

const createSugerenciaSchema = z.object({
  asunto: z.string().min(3, 'El asunto debe tener al menos 3 caracteres'),
  mensaje: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres'),
});

export const createSugerencia = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const raw = req.body;
    const data = createSugerenciaSchema.parse({
      asunto: raw.asunto || raw.subject,
      mensaje: raw.mensaje || raw.message,
    });

    // Obtener ficha del usuario si es aprendiz
    const userRes = await query('SELECT ficha_id FROM usuarios WHERE id = $1;', [userId]);
    const fichaId = userRes.rows[0]?.ficha_id || null;

    const insertRes = await query(
      `INSERT INTO sugerencias (usuario_id, ficha_id, asunto, mensaje, estado)
       VALUES ($1, $2, $3, $4, 'pendiente')
       RETURNING *;`,
      [userId, fichaId, data.asunto.trim(), data.mensaje.trim()]
    );

    return res.status(201).json({
      id: insertRes.rows[0].id,
      asunto: insertRes.rows[0].asunto,
      mensaje: insertRes.rows[0].mensaje,
      estado: insertRes.rows[0].estado,
      message: '¡Sugerencia enviada correctamente al comedor!',
    });
  } catch (error) {
    next(error);
  }
};

export const responderSugerencia = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { respuesta = 'Atendida por la administración del comedor.' } = req.body;

    const updateRes = await query(
      `UPDATE sugerencias
       SET estado = 'atendida',
           respuesta = $1,
           atendida_por = $2,
           atendida_en = NOW()
       WHERE id = $3
       RETURNING *;`,
      [respuesta.trim(), req.user?.id || null, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ message: 'Sugerencia no encontrada.' });
    }

    return res.json({
      message: 'Sugerencia marcada como atendida.',
      sugerencia: updateRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};
