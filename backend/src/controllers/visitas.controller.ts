import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const getVisitas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT v.id, v.institucion_id, i.nombre as institucion_nombre,
              v.instructor_id, u.nombre as instructor_nombre,
              v.nombre_instructor_ext, v.cantidad_personas,
              v.fecha_visita, v.precio_unitario, v.total_a_cobrar,
              v.estado, v.metodo_pago, v.estado_pago, v.created_at
       FROM visitas_institucionales v
       JOIN instituciones i ON v.institucion_id = i.id
       LEFT JOIN usuarios u ON v.instructor_id = u.id
       ORDER BY v.fecha_visita DESC, v.created_at DESC;`
    );

    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getVisitasKPI = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::int as "totalVisitasMes",
              COALESCE(SUM(cantidad_personas), 0)::int as "totalPersonasAtendidas",
              COALESCE(SUM(total_a_cobrar), 0)::numeric as "ingresosVisitas"
       FROM visitas_institucionales
       WHERE fecha_visita >= DATE_TRUNC('month', CURRENT_DATE);`
    );

    return res.json({
      totalVisitasMes: result.rows[0]?.totalVisitasMes || 0,
      totalPersonasAtendidas: result.rows[0]?.totalPersonasAtendidas || 0,
      ingresosVisitas: Number(result.rows[0]?.ingresosVisitas || 0),
    });
  } catch (error) {
    next(error);
  }
};

const visitaSchema = z
  .object({
    institucion_id: z.string().uuid('ID de institución inválido'),
    instructor_id: z.string().uuid('ID de instructor inválido').optional().nullable(),
    nombre_instructor_ext: z.string().optional().nullable(),
    cantidad_personas: z.coerce.number().int().positive('La cantidad de personas debe ser mayor a 0'),
    fecha_visita: z.string().min(1, 'La fecha de visita es obligatoria'),
    precio_unitario: z.coerce.number().positive().optional(),
    metodo_pago: z.enum(['efectivo', 'transferencia', 'credito_deuda']).default('efectivo'),
    observaciones: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasInterno = !!data.instructor_id;
      const hasExterno = !!data.nombre_instructor_ext && data.nombre_instructor_ext.trim().length > 0;
      return (hasInterno && !hasExterno) || (!hasInterno && hasExterno);
    },
    {
      message: 'Debes especificar exactamente uno: o un instructor SENA interno, o el nombre de un instructor externo.',
      path: ['instructor_id'],
    }
  );

export const createVisita = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = visitaSchema.parse(req.body);

    const instRes = await query('SELECT nombre FROM instituciones WHERE id = $1;', [data.institucion_id]);
    if (instRes.rows.length === 0) {
      return res.status(404).json({ message: 'Institución no encontrada.' });
    }
    const institucionNombre = instRes.rows[0].nombre;

    let precioUnitario = data.precio_unitario;
    if (!precioUnitario) {
      const activeMenuRes = await query(
        "SELECT precio_invitado FROM menus_dia WHERE estado = 'activo' ORDER BY fecha DESC LIMIT 1;"
      );
      precioUnitario = activeMenuRes.rows[0]?.precio_invitado ? Number(activeMenuRes.rows[0].precio_invitado) : 8000;
    }

    const insertRes = await query(
      `INSERT INTO visitas_institucionales (
         institucion_id, instructor_id, nombre_instructor_ext,
         cantidad_personas, fecha_visita, precio_unitario,
         estado, metodo_pago, estado_pago, observaciones, creado_por
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'programada', $7, 'pendiente', $8, $9)
       RETURNING *;`,
      [
        data.institucion_id,
        data.instructor_id || null,
        data.nombre_instructor_ext ? data.nombre_instructor_ext.trim() : null,
        data.cantidad_personas,
        data.fecha_visita,
        precioUnitario,
        data.metodo_pago,
        data.observaciones || '',
        req.user?.id || null,
      ]
    );

    const created = insertRes.rows[0];

    return res.status(201).json({
      ...created,
      institucion_nombre: institucionNombre,
      precio_unitario: Number(created.precio_unitario),
      total_a_cobrar: Number(created.total_a_cobrar),
    });
  } catch (error) {
    next(error);
  }
};
