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

/**
 * GET /api/grupos/:id/aprendices
 * Retorna ÚNICAMENTE los aprendices de una ficha que reservaron almuerzo hoy
 * (zona horaria America/Bogota), con su estado de pago.
 * Acceso: encargado
 */
export const getAprendicesDeGrupo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verificar que la ficha existe
    const fichaRes = await query('SELECT id, codigo_ficha, programa FROM fichas WHERE id = $1;', [id]);
    if (fichaRes.rows.length === 0) {
      return res.status(404).json({ message: 'Ficha/grupo no encontrado.' });
    }

    // Solo aprendices de esta ficha que hayan reservado hoy en zona horaria America/Bogota
    const result = await query(
      `SELECT u.id,
              u.nombre as name,
              u.cedula as document,
              u.email,
              u.es_beneficiario,
              v.id as venta_id,
              v.precio_cobrado::float8 as precio,
              v.metodo_pago,
              v.estado_pago,
              UPPER(v.estado_pago::text) as payment_status,
              v.fecha_hora
       FROM usuarios u
       INNER JOIN ventas v ON v.usuario_id = u.id
       WHERE u.ficha_id = $1
         AND u.rol = 'aprendiz'
         AND u.activo = true
         AND v.estado = 'completada'
         AND DATE(v.fecha_hora AT TIME ZONE 'America/Bogota') = (NOW() AT TIME ZONE 'America/Bogota')::date
       ORDER BY u.nombre ASC;`,
      [id]
    );

    return res.json({
      ficha: fichaRes.rows[0],
      aprendices: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/grupos/ventas/:ventaId/pago
 * Marca el estado de pago de una venta como 'pagado' o 'pendiente'.
 * No altera metodo_pago.
 * Bloquea con 400 si la venta es gratis (beneficiario).
 * Acceso: encargado
 */
export const marcarPagoVenta = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { ventaId } = req.params;
    const { pagado } = req.body; // boolean: true = pagado, false = pendiente

    if (typeof pagado !== 'boolean') {
      return res.status(400).json({ message: "El campo 'pagado' debe ser booleano (true o false)." });
    }

    const ventaRes = await query(
      'SELECT id, usuario_id, precio_cobrado::float8 as precio_cobrado, metodo_pago, estado_pago FROM ventas WHERE id = $1;',
      [ventaId]
    );

    if (ventaRes.rows.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    const venta = ventaRes.rows[0];

    // Restricción: No se permite toggle en ventas de beneficiarios (gratis / cortesía)
    if (venta.estado_pago === 'gratis' || venta.precio_cobrado === 0) {
      return res.status(400).json({
        message: 'Las reservas de cortesía/beneficiarios no permiten alternar el estado de pago.',
      });
    }

    const nuevoEstado = pagado ? 'pagado' : 'pendiente';

    await query(
      'UPDATE ventas SET estado_pago = $1 WHERE id = $2;',
      [nuevoEstado, ventaId]
    );

    return res.json({
      message: pagado ? 'Almuerzo marcado como pagado.' : 'Almuerzo revertido a pendiente.',
      ventaId,
      payment_status: pagado ? 'PAGADO' : 'PENDIENTE',
      estado_pago: nuevoEstado,
    });
  } catch (error) {
    next(error);
  }
};
