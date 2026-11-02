import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { parseId } from '../utils/validacion.js';

/** Condición SQL: la venta se registró hoy en hora de Colombia. */
const VENTA_DE_HOY =
  "DATE(v.fecha_hora AT TIME ZONE 'America/Bogota') = (NOW() AT TIME ZONE 'America/Bogota')::date";

/**
 * GET /api/grupos
 * Fichas con sus aprendices registrados y el resumen de reservas de hoy.
 * Acceso: encargado
 */
export const getGrupos = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT f.id, f.codigo_ficha as ficha, f.programa as program,
              COALESCE(INITCAP(f.jornada), 'Mañana') as shift,
              i.nombre as instructor,
              (SELECT COUNT(*) FROM usuarios a
                WHERE a.ficha_id = f.id AND a.rol = 'aprendiz' AND a.activo = true)::int as "studentsCount",
              hoy.reservas as "reservasHoy",
              hoy.pendientes as "pendientesHoy",
              hoy.pagados as "pagadosHoy",
              hoy.gratis as "gratisHoy"
       FROM fichas f
       LEFT JOIN usuarios i ON f.instructor_id = i.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int as reservas,
                COUNT(*) FILTER (WHERE v.estado_pago = 'pendiente')::int as pendientes,
                COUNT(*) FILTER (WHERE v.estado_pago = 'pagado')::int as pagados,
                COUNT(*) FILTER (WHERE v.estado_pago = 'gratis')::int as gratis
         FROM ventas v
         JOIN usuarios a ON a.id = v.usuario_id
         WHERE a.ficha_id = f.id AND a.rol = 'aprendiz' AND v.estado = 'completada' AND ${VENTA_DE_HOY}
       ) hoy ON true
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
              (SELECT COUNT(*) FROM usuarios a
                WHERE a.ficha_id = f.id AND a.rol = 'aprendiz' AND a.activo = true)::int as "studentsCount",
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
    const id = parseId(req.params.id, 'El identificador del grupo no es válido.');

    const fichaRes = await query('SELECT id, codigo_ficha, programa FROM fichas WHERE id = $1;', [id]);
    if (fichaRes.rows.length === 0) {
      return res.status(404).json({ message: 'Ficha/grupo no encontrado.' });
    }

    const result = await query(
      `SELECT u.id,
              u.nombre as name,
              u.cedula as document,
              u.email,
              u.es_beneficiario,
              v.id as venta_id,
              v.precio_cobrado::float8 as precio,
              v.estado_pago,
              UPPER(v.estado_pago::text) as payment_status,
              v.fecha_hora
       FROM usuarios u
       INNER JOIN ventas v ON v.usuario_id = u.id
       WHERE u.ficha_id = $1
         AND u.rol = 'aprendiz'
         AND u.activo = true
         AND v.estado = 'completada'
         AND ${VENTA_DE_HOY}
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

const pagoVentaSchema = z.object({
  pagado: z.boolean({ message: "El campo 'pagado' debe ser booleano (true o false)." }),
});

/**
 * PATCH /api/grupos/ventas/:ventaId/pago
 * Marca el estado de pago de la reserva de un aprendiz como 'pagado' o 'pendiente'.
 * Rechaza las reservas gratis (beneficiarios) y las de otros roles: los instructores
 * se gestionan en Cartera de Deudas.
 * Acceso: encargado
 */
export const marcarPagoVenta = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ventaId = parseId(req.params.ventaId, 'El identificador de la venta no es válido.');
    const parsed = pagoVentaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "El campo 'pagado' debe ser booleano (true o false)." });
    }
    const { pagado } = parsed.data;

    const ventaRes = await query(
      `SELECT v.id, v.precio_cobrado::float8 as precio_cobrado, v.estado_pago, v.estado, u.rol
       FROM ventas v
       JOIN usuarios u ON u.id = v.usuario_id
       WHERE v.id = $1;`,
      [ventaId]
    );

    if (ventaRes.rows.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    const venta = ventaRes.rows[0];

    if (venta.estado !== 'completada') {
      return res.status(400).json({ message: 'La reserva fue anulada; no se puede cambiar su estado de pago.' });
    }

    if (venta.rol !== 'aprendiz') {
      return res.status(400).json({
        message: 'Solo se controla aquí el pago de aprendices. Los instructores se gestionan en Cartera de Deudas.',
      });
    }

    if (venta.estado_pago === 'gratis' || venta.precio_cobrado === 0) {
      return res.status(400).json({
        message: 'Las reservas de cortesía/beneficiarios no permiten alternar el estado de pago.',
      });
    }

    const nuevoEstado = pagado ? 'pagado' : 'pendiente';

    await query('UPDATE ventas SET estado_pago = $1 WHERE id = $2;', [nuevoEstado, ventaId]);

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
