import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { TARIFAS_ALMUERZO_INVITADO } from '../config/almuerzosInvitados.js';
import { esFechaAnteriorAHoy, esFechaValida, fechaBogota } from '../utils/horario.js';
import { parseId } from '../utils/validacion.js';
import { withTransaction } from '../services/inventario.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';

/**
 * Precio por persona de una visita cuando el encargado no envía uno: la tarifa de
 * almuerzo invitado corriente, para que las tarifas vivan en un solo lugar (ADR 016).
 * El precio y el total quedan guardados en la visita: el histórico no cambia con las tarifas.
 */
const PRECIO_VISITA_POR_DEFECTO = TARIFAS_ALMUERZO_INVITADO.corriente;

/** Máximo de caracteres de la institución y del responsable (igual al CHECK de la migración 008). */
export const MAX_NOMBRE_VISITA = 150;

export const MENSAJE_FECHA_PASADA = 'La fecha no puede ser anterior a hoy';
export const MENSAJE_VISITA_FUTURA = 'Solo puedes marcarla el día de la visita o después';

/**
 * Columnas que devuelve la API. La institución y el responsable son texto libre (migración 008).
 * Fecha como texto y montos como número: pg convierte DATE a medianoche local y NUMERIC a string.
 */
const COLUMNAS_VISITA = `v.id, v.institucion_nombre, v.responsable_nombre, v.cantidad_personas,
  to_char(v.fecha_visita, 'YYYY-MM-DD') as fecha_visita,
  v.precio_unitario::float8 as precio_unitario, v.total_a_cobrar::float8 as total_a_cobrar,
  v.estado, v.metodo_pago, v.estado_pago, v.created_at,
  v.fecha_hora_realizada, u.nombre as confirmada_por_nombre`;

const SELECT_VISITA = `SELECT ${COLUMNAS_VISITA}
  FROM visitas_institucionales v
  LEFT JOIN usuarios u ON u.id = v.confirmada_por`;

export const getVisitas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`${SELECT_VISITA} ORDER BY v.fecha_visita DESC, v.created_at DESC;`);
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/visitas/kpi — las tarjetas cuentan solo las visitas realizadas del mes (hora de Colombia);
 * programadasPendientes son las que aún no se marcan como realizadas (de cualquier fecha).
 */
export const getVisitasKPI = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT COUNT(*) FILTER (WHERE estado = 'realizada' AND mes)::int AS "totalVisitasMes",
              COALESCE(SUM(cantidad_personas) FILTER (WHERE estado = 'realizada' AND mes), 0)::int AS "totalPersonasAtendidas",
              COALESCE(SUM(total_a_cobrar) FILTER (WHERE estado = 'realizada' AND mes), 0)::float8 AS "ingresosVisitas",
              COUNT(*) FILTER (WHERE estado = 'programada')::int AS "programadasPendientes"
       FROM (
         SELECT estado, cantidad_personas, total_a_cobrar,
                DATE_TRUNC('month', fecha_visita) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'America/Bogota')::date) AS mes
         FROM visitas_institucionales
       ) v;`
    );
    const fila = result.rows[0];
    return res.json({
      totalVisitasMes: fila?.totalVisitasMes ?? 0,
      totalPersonasAtendidas: fila?.totalPersonasAtendidas ?? 0,
      ingresosVisitas: Number(fila?.ingresosVisitas ?? 0),
      programadasPendientes: fila?.programadasPendientes ?? 0,
    });
  } catch (error) {
    next(error);
  }
};

/** Texto libre obligatorio: sin espacios al inicio ni al final, no vacío y de máximo 150 caracteres. */
const nombreSchema = (campo: string) =>
  z
    .string({ error: `${campo} es obligatorio.` })
    .trim()
    .min(1, `${campo} es obligatorio.`)
    .max(MAX_NOMBRE_VISITA, `${campo} no puede superar ${MAX_NOMBRE_VISITA} caracteres.`);

/** 'YYYY-MM-DD' real y que no sea anterior a hoy en Colombia (solo la fecha, sin la hora). */
const fechaVisitaSchema = z
  .string({ error: 'La fecha de visita es obligatoria.' })
  .min(1, 'La fecha de visita es obligatoria.')
  .refine(esFechaValida, 'La fecha de visita no es válida (AAAA-MM-DD).')
  .refine((fecha) => !esFechaAnteriorAHoy(fecha), MENSAJE_FECHA_PASADA);

const visitaSchema = z.object({
  institucionNombre: nombreSchema('El nombre de la institución'),
  responsableNombre: nombreSchema('El nombre del responsable'),
  cantidad_personas: z.coerce.number().int().positive('La cantidad de personas debe ser mayor a 0'),
  fecha_visita: fechaVisitaSchema,
  precio_unitario: z.coerce.number().positive().optional(),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'credito_deuda']).default('efectivo'),
  observaciones: z.string().optional(),
});

/** Responde 400 con el mensaje de la fecha pasada tal cual (sin el prefijo "Error de validación"). */
const validarVisita = (body: unknown) => {
  const parsed = visitaSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const fechaPasada = parsed.error.issues.find((i) => i.message === MENSAJE_FECHA_PASADA);
    if (fechaPasada) throw new AppError(MENSAJE_FECHA_PASADA, 400);
    throw parsed.error;
  }
  return parsed.data;
};

/**
 * POST /api/visitas — body: { institucionNombre, responsableNombre, cantidad_personas, fecha_visita,
 * precio_unitario?, metodo_pago?, observaciones? }. El total (personas × precio) lo calcula la BD.
 */
export const createVisita = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = validarVisita(req.body);
    const precioUnitario = data.precio_unitario ?? PRECIO_VISITA_POR_DEFECTO;

    const visita = await withTransaction(async (client) => {
      const insertRes = await client.query(
        `INSERT INTO visitas_institucionales (
           institucion_nombre, responsable_nombre,
           cantidad_personas, fecha_visita, precio_unitario,
           estado, metodo_pago, estado_pago, observaciones, creado_por
         )
         VALUES ($1, $2, $3, $4, $5, 'programada', $6, 'pendiente', $7, $8)
         RETURNING id;`,
        [
          data.institucionNombre,
          data.responsableNombre,
          data.cantidad_personas,
          data.fecha_visita,
          precioUnitario,
          data.metodo_pago,
          data.observaciones || null,
          req.user?.id || null,
        ]
      );
      const creada = (await client.query(`${SELECT_VISITA} WHERE v.id = $1;`, [insertRes.rows[0].id])).rows[0];
      await registrarAuditoria(
        { usuario: req.user, accion: 'crear', entidad: 'visita', entidadId: creada.id, despues: creada },
        client
      );
      return creada;
    });

    return res.status(201).json(visita);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/visitas/:id/realizada — programada → realizada, solo el día de la visita o después.
 * Si ya está realizada (o cancelada) responde 409. Guarda cuándo y quién la confirmó.
 */
export const marcarVisitaRealizada = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la visita no es válido.');
    const visita = await withTransaction(async (client) => {
      const actual = await client.query(
        `SELECT id, institucion_nombre, estado, to_char(fecha_visita, 'YYYY-MM-DD') AS fecha_visita
         FROM visitas_institucionales WHERE id = $1 FOR UPDATE;`,
        [id]
      );
      const anterior = actual.rows[0];
      if (!anterior) throw new AppError('Visita no encontrada.', 404);
      if (anterior.estado === 'realizada') throw new AppError('La visita ya está marcada como realizada.', 409);
      if (anterior.estado !== 'programada') {
        throw new AppError(`Solo una visita programada puede marcarse como realizada (estado actual: ${anterior.estado}).`, 409);
      }
      if (anterior.fecha_visita > fechaBogota()) throw new AppError(`${MENSAJE_VISITA_FUTURA}.`, 409);

      await client.query(
        `UPDATE visitas_institucionales
         SET estado = 'realizada', fecha_hora_realizada = NOW(), confirmada_por = $2, updated_at = NOW()
         WHERE id = $1;`,
        [id, req.user!.id]
      );
      const actualizada = (await client.query(`${SELECT_VISITA} WHERE v.id = $1;`, [id])).rows[0];
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'marcar_realizada',
          entidad: 'visita',
          entidadId: id,
          antes: { estado: 'programada', institucion: anterior.institucion_nombre, fecha_visita: anterior.fecha_visita },
          despues: { estado: 'realizada', fecha_hora_realizada: actualizada.fecha_hora_realizada },
        },
        client
      );
      return actualizada;
    });
    return res.json(visita);
  } catch (error) {
    next(error);
  }
};
