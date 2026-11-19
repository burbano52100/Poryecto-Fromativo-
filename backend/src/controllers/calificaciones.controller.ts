import { Response, NextFunction } from 'express';
import { z } from 'zod';
import type pg from 'pg';
import { pool, query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseId } from '../utils/validacion.js';
import { rangoCampos, resolverRango } from '../utils/rango.js';

/**
 * Calificación del almuerzo (ADR 022). Aprendices e instructores califican el almuerzo del día
 * solo si lo reservaron; una vez por menú, y pueden editarla hasta el final de ese día (Colombia).
 * El encargado ve las calificaciones de forma anónima: nunca recibe el nombre de quien califica.
 */
type Queryable = Pick<pg.PoolClient, 'query'>;

export const MAX_COMENTARIO = 300;

const calificacionSchema = z.object({
  estrellas: z
    .number({ error: 'Elige de 1 a 5 estrellas.' })
    .int('Elige de 1 a 5 estrellas.')
    .min(1, 'Elige de 1 a 5 estrellas.')
    .max(5, 'Elige de 1 a 5 estrellas.'),
  comentario: z
    .string()
    .trim()
    .max(MAX_COMENTARIO, `El comentario no puede superar ${MAX_COMENTARIO} caracteres.`)
    .nullish()
    .transform((c) => c || null),
});

const crearSchema = calificacionSchema.extend({
  menu_id: z.string({ error: 'Falta el menú.' }).uuid('El menú no es válido.'),
});

/** Menú de hoy (Colombia) que el usuario reservó, con su calificación si ya la hizo. */
async function menuReservadoHoy(db: Queryable, usuarioId: string) {
  const res = await db.query(
    `SELECT m.id, m.nombre, TO_CHAR(m.fecha, 'YYYY-MM-DD') AS fecha,
            c.id AS calificacion_id, c.estrellas, c.comentario
     FROM ventas v
     JOIN menus_dia m ON m.id = v.menu_id
     LEFT JOIN calificaciones_almuerzo c ON c.menu_id = m.id AND c.usuario_id = v.usuario_id
     WHERE v.usuario_id = $1 AND v.estado = 'completada'
       AND m.fecha = (NOW() AT TIME ZONE 'America/Bogota')::date
     ORDER BY v.fecha_hora DESC
     LIMIT 1;`,
    [usuarioId]
  );
  return res.rows[0] ?? null;
}

/** GET /api/calificaciones/hoy — si el usuario puede calificar el almuerzo de hoy y su calificación. */
export const getCalificacionHoy = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const menu = await menuReservadoHoy(pool, req.user!.id);
    if (!menu) {
      return res.json({ puede_calificar: false, motivo: 'Solo puedes calificar el almuerzo del día si lo reservaste.', menu: null, calificacion: null });
    }
    return res.json({
      puede_calificar: true,
      menu: { id: menu.id, nombre: menu.nombre, fecha: menu.fecha },
      calificacion: menu.calificacion_id
        ? { id: menu.calificacion_id, estrellas: menu.estrellas, comentario: menu.comentario }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/calificaciones — body: { menu_id, estrellas, comentario? }. Una por menú y usuario. */
export const crearCalificacion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = crearSchema.parse(req.body ?? {});
    const menu = await menuReservadoHoy(pool, req.user!.id);
    if (!menu || menu.id !== data.menu_id) {
      throw new AppError('Solo puedes calificar el almuerzo de hoy si lo reservaste o consumiste.', 403);
    }
    if (menu.calificacion_id) {
      throw new AppError('Ya calificaste el almuerzo de hoy: puedes editar tu calificación hasta el final del día.', 409);
    }
    const insertRes = await query(
      `INSERT INTO calificaciones_almuerzo (menu_id, usuario_id, estrellas, comentario)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT unq_calificacion_menu_usuario DO NOTHING
       RETURNING id, estrellas, comentario;`,
      [data.menu_id, req.user!.id, data.estrellas, data.comentario]
    );
    if (!insertRes.rows[0]) {
      throw new AppError('Ya calificaste el almuerzo de hoy: puedes editar tu calificación hasta el final del día.', 409);
    }
    return res.status(201).json({ message: '¡Gracias por calificar el almuerzo!', calificacion: insertRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/calificaciones/:id — body: { estrellas, comentario? }. Solo la propia y el mismo día del menú. */
export const editarCalificacion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la calificación no es válido.');
    const data = calificacionSchema.parse(req.body ?? {});
    const actual = await query(
      `SELECT c.id, c.usuario_id, (m.fecha = (NOW() AT TIME ZONE 'America/Bogota')::date) AS es_hoy
       FROM calificaciones_almuerzo c JOIN menus_dia m ON m.id = c.menu_id
       WHERE c.id = $1;`,
      [id]
    );
    const calificacion = actual.rows[0];
    if (!calificacion || calificacion.usuario_id !== req.user!.id) throw new AppError('Calificación no encontrada.', 404);
    if (!calificacion.es_hoy) throw new AppError('Solo puedes editar tu calificación hasta el final del día del almuerzo.', 409);
    const updateRes = await query(
      `UPDATE calificaciones_almuerzo SET estrellas = $1, comentario = $2, fecha_hora = NOW()
       WHERE id = $3 RETURNING id, estrellas, comentario;`,
      [data.estrellas, data.comentario, id]
    );
    return res.json({ message: 'Calificación actualizada.', calificacion: updateRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

const filtrosSchema = z.object({
  ...rangoCampos,
  estrellas: z.coerce.number().int().min(1).max(5).optional(),
});

/**
 * GET /api/calificaciones?desde=&hasta=&estrellas= — solo el encargado. Promedio por día,
 * distribución de estrellas y comentarios anónimos (sin usuario). Por defecto, los últimos 30 días.
 */
export const getCalificacionesEncargado = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filtros = filtrosSchema.parse(req.query);
    const { desde, hasta } = resolverRango(filtros, 30);
    const params = [desde, hasta];
    const [resumen, distribucion, porDia, comentarios] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total, ROUND(AVG(c.estrellas), 2)::float8 AS promedio,
                COUNT(*) FILTER (WHERE c.estrellas <= 2)::int AS bajas
         FROM calificaciones_almuerzo c JOIN menus_dia m ON m.id = c.menu_id
         WHERE m.fecha BETWEEN $1 AND $2;`,
        params
      ),
      query(
        `SELECT e.n AS estrellas, COUNT(c.id)::int AS total
         FROM generate_series(1, 5) AS e(n)
         LEFT JOIN (calificaciones_almuerzo c JOIN menus_dia m ON m.id = c.menu_id AND m.fecha BETWEEN $1 AND $2)
           ON c.estrellas = e.n
         GROUP BY e.n ORDER BY e.n;`,
        params
      ),
      query(
        `SELECT TO_CHAR(m.fecha, 'YYYY-MM-DD') AS fecha, MIN(m.nombre) AS menu,
                ROUND(AVG(c.estrellas), 2)::float8 AS promedio, COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE c.estrellas <= 2)::int AS bajas
         FROM calificaciones_almuerzo c JOIN menus_dia m ON m.id = c.menu_id
         WHERE m.fecha BETWEEN $1 AND $2
         GROUP BY m.fecha ORDER BY m.fecha;`,
        params
      ),
      // Anónimas: sin usuario_id ni nombre
      query(
        `SELECT c.id, TO_CHAR(m.fecha, 'YYYY-MM-DD') AS fecha, m.nombre AS menu, c.estrellas, c.comentario,
                (c.estrellas <= 2) AS baja
         FROM calificaciones_almuerzo c JOIN menus_dia m ON m.id = c.menu_id
         WHERE m.fecha BETWEEN $1 AND $2 AND ($3::int IS NULL OR c.estrellas = $3)
         ORDER BY m.fecha DESC, c.estrellas ASC, c.fecha_hora DESC
         LIMIT 300;`,
        [...params, filtros.estrellas ?? null]
      ),
    ]);
    return res.json({
      desde,
      hasta,
      resumen: resumen.rows[0],
      distribucion: distribucion.rows,
      por_dia: porDia.rows,
      comentarios: comentarios.rows,
    });
  } catch (error) {
    next(error);
  }
};
