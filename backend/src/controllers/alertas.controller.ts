import { Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { parseId } from '../utils/validacion.js';

/** GET /api/alertas?todas=true — las 100 más recientes (por defecto, solo las no leídas). */
export const listarAlertas = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const todas = req.query.todas === 'true';
    const result = await query(
      `SELECT id, tipo, mensaje, datos, leida, created_at
       FROM alertas
       ${todas ? '' : 'WHERE leida = false'}
       ORDER BY created_at DESC
       LIMIT 100;`
    );
    const pendientes = await query('SELECT COUNT(*)::int AS n FROM alertas WHERE leida = false;');
    return res.json({
      pendientes: pendientes.rows[0].n,
      items: result.rows.map((a) => ({ ...a, created_at: new Date(a.created_at).toISOString() })),
    });
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/alertas/:id/leida */
export const marcarAlertaLeida = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la alerta no es válido.');
    const result = await query(
      'UPDATE alertas SET leida = true, leida_por = $1, leida_en = NOW() WHERE id = $2 RETURNING id;',
      [req.user!.id, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Alerta no encontrada.' });
    return res.json({ message: 'Alerta marcada como leída.' });
  } catch (error) {
    next(error);
  }
};

/** POST /api/alertas/leer-todas */
export const marcarTodasLeidas = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'UPDATE alertas SET leida = true, leida_por = $1, leida_en = NOW() WHERE leida = false;',
      [req.user!.id]
    );
    return res.json({ message: `${result.rowCount} alerta(s) marcadas como leídas.` });
  } catch (error) {
    next(error);
  }
};
