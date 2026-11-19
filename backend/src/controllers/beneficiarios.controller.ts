import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseId } from '../utils/validacion.js';
import { fechaBogota } from '../utils/horario.js';
import { fechaSchema } from '../utils/rango.js';
import { withTransaction } from '../services/inventario.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import {
  estadoCupo,
  finalizarBeneficio,
  finalizarBeneficiosVencidos,
  MOTIVOS_FIN,
  MOTIVOS_FIN_MANUALES,
  ORDEN_ESPERA,
  primeroEnEspera,
} from '../services/beneficios.service.js';

/**
 * Beneficiarios del almuerzo a $0 (ADR 019). Cada alta es un registro en `beneficios` con fechas,
 * prioridad y la confirmación de que el aprendiz no recibe otro apoyo incompatible. Con el cupo
 * lleno, el aprendiz queda en lista de espera; al liberarse un cupo el sistema sugiere al primero
 * y el encargado confirma. Todo queda en la auditoría.
 */

/** Columnas de un beneficio con los datos del aprendiz (alias b, u, f). */
const COLUMNAS_BENEFICIO = `b.id, b.usuario_id, u.nombre, u.cedula, u.email, u.estado AS estado_cuenta,
  COALESCE(f.codigo_ficha, '') AS ficha, f.programa,
  b.estado, TO_CHAR(b.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, TO_CHAR(b.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
  b.prioridad, b.sin_apoyo_incompatible, b.motivo_fin, b.detalle_fin, b.fecha_finalizacion, b.created_at`;

const FROM_BENEFICIO = `FROM beneficios b
  JOIN usuarios u ON u.id = b.usuario_id
  LEFT JOIN fichas f ON f.id = u.ficha_id`;

const formatear = (b: Record<string, any>): Record<string, any> => ({
  ...b,
  motivo_fin_texto: b.motivo_fin ? MOTIVOS_FIN[b.motivo_fin as keyof typeof MOTIVOS_FIN] : null,
  fecha_finalizacion: b.fecha_finalizacion ? new Date(b.fecha_finalizacion).toISOString() : null,
  created_at: new Date(b.created_at).toISOString(),
});

const prioridadSchema = z.coerce
  .number({ error: 'La prioridad debe ser un número.' })
  .int('La prioridad debe ser un número entero.')
  .min(1, 'La prioridad debe ser 1 o mayor (1 es la más alta).')
  .max(99, 'La prioridad no puede superar 99.');

const altaSchema = z
  .object({
    usuario_id: z.string({ error: 'Selecciona el aprendiz.' }).uuid('El aprendiz seleccionado no es válido.'),
    fecha_inicio: fechaSchema('La fecha de inicio').optional(),
    fecha_fin: fechaSchema('La fecha de fin').nullish(),
    prioridad: prioridadSchema.default(1),
    sin_apoyo_incompatible: z.literal(true, {
      error:
        'Debes confirmar que el aprendiz no recibe otro apoyo incompatible (sostenimiento, monitoría, Jóvenes en Acción o contrato de aprendizaje).',
    }),
  })
  .transform((d) => ({ ...d, fecha_inicio: d.fecha_inicio ?? fechaBogota(), fecha_fin: d.fecha_fin ?? null }))
  .refine((d) => d.fecha_inicio <= fechaBogota(), {
    message: 'La fecha de inicio no puede ser futura.',
    path: ['fecha_inicio'],
  })
  .refine((d) => !d.fecha_fin || d.fecha_fin >= d.fecha_inicio, {
    message: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
    path: ['fecha_fin'],
  })
  .refine((d) => !d.fecha_fin || d.fecha_fin >= fechaBogota(), {
    message: 'La fecha de fin no puede ser anterior a hoy.',
    path: ['fecha_fin'],
  });

const editarSchema = z
  .object({
    prioridad: prioridadSchema.optional(),
    fecha_fin: fechaSchema('La fecha de fin').nullable().optional(),
  })
  .refine((d) => d.prioridad !== undefined || d.fecha_fin !== undefined, 'No hay cambios para guardar.')
  .refine((d) => !d.fecha_fin || d.fecha_fin >= fechaBogota(), {
    message: 'La fecha de fin no puede ser anterior a hoy.',
    path: ['fecha_fin'],
  });

const finalizarSchema = z
  .object({
    motivo: z.enum(MOTIVOS_FIN_MANUALES, {
      error: 'Elige el motivo de fin: retiro, inasistencias, mal uso, información falsa u otro.',
    }),
    detalle: z.string().trim().max(300, 'El detalle no puede superar 300 caracteres.').nullish(),
  })
  .refine((d) => d.motivo !== 'otro' || (d.detalle ?? '').length >= 3, {
    message: 'Describe el motivo cuando eliges "Otro".',
    path: ['detalle'],
  });

const filtrosSchema = z.object({
  estado: z.enum(['vigentes', 'activo', 'en_espera', 'finalizado', 'todos']).default('vigentes'),
});

/** Termina los beneficios vencidos antes de responder, para que la lista siempre esté al día. */
const alDia = () => withTransaction((client) => finalizarBeneficiosVencidos(client));

/**
 * GET /api/beneficiarios/estudiantes — aprendices activos con su beneficio vigente (si tienen),
 * para elegir a quién dar de alta.
 */
export const getEstudiantes = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await alDia();
    const result = await query(
      `SELECT u.id, u.nombre AS name, u.cedula AS document, u.email, u.es_beneficiario,
              COALESCE(f.codigo_ficha, '') AS ficha, u.activo, u.created_at,
              b.estado AS estado_beneficio
       FROM usuarios u
       LEFT JOIN fichas f ON u.ficha_id = f.id
       LEFT JOIN beneficios b ON b.usuario_id = u.id AND b.estado <> 'finalizado'
       WHERE u.rol = 'aprendiz' AND u.estado = 'activo'
       ORDER BY u.nombre ASC;`
    );
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/beneficiarios?estado=vigentes|activo|en_espera|finalizado|todos
 * Beneficios con el estado del cupo y, si hay cupo libre, el primero de la lista de espera sugerido.
 */
export const getBeneficiarios = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { estado } = filtrosSchema.parse(req.query);
    await alDia();
    const condicion =
      estado === 'vigentes' ? "b.estado <> 'finalizado'" : estado === 'todos' ? 'TRUE' : 'b.estado = $1';
    const params = estado === 'vigentes' || estado === 'todos' ? [] : [estado];
    const [items, cupo, primero] = await Promise.all([
      query(
        `SELECT ${COLUMNAS_BENEFICIO} ${FROM_BENEFICIO}
         WHERE ${condicion}
         ORDER BY CASE b.estado WHEN 'activo' THEN 0 WHEN 'en_espera' THEN 1 ELSE 2 END,
                  CASE WHEN b.estado = 'en_espera' THEN b.prioridad END, b.created_at ASC, u.nombre ASC
         LIMIT 1000;`,
        params
      ),
      estadoCupo(),
      primeroEnEspera(),
    ]);
    // Posición en la lista de espera (1 = el siguiente)
    let posicion = 0;
    const lista = items.rows.map((b) => ({ ...formatear(b), posicion_espera: b.estado === 'en_espera' ? ++posicion : null }));
    return res.json({
      cupo,
      sugerido: cupo.disponibles > 0 && primero ? { beneficio_id: primero.id, nombre: primero.nombre, cedula: primero.cedula } : null,
      items: lista,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/beneficiarios/historial/:usuarioId — todos los beneficios (altas y finales) de un aprendiz. */
export const getHistorialBeneficiario = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const usuarioId = parseId(req.params.usuarioId, 'El identificador del aprendiz no es válido.');
    const result = await query(`SELECT ${COLUMNAS_BENEFICIO} ${FROM_BENEFICIO} WHERE b.usuario_id = $1 ORDER BY b.created_at DESC;`, [
      usuarioId,
    ]);
    return res.json(result.rows.map(formatear));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/beneficiarios — body: { usuario_id, fecha_inicio?, fecha_fin?, prioridad?, sin_apoyo_incompatible: true }.
 * Queda activo si hay cupo; si no, entra a la lista de espera (por prioridad y fecha).
 */
export const darDeAlta = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = altaSchema.parse(req.body ?? {});
    await alDia();
    const beneficio = await withTransaction(async (client) => {
      // Un alta a la vez: el cupo se cuenta sin que otra alta se cruce
      await client.query("SELECT pg_advisory_xact_lock(hashtext('beneficios_cupo'));");
      const aprendizRes = await client.query(
        "SELECT id, nombre, cedula, rol, estado FROM usuarios WHERE id = $1 FOR UPDATE;",
        [data.usuario_id]
      );
      const aprendiz = aprendizRes.rows[0];
      if (!aprendiz || aprendiz.rol !== 'aprendiz') throw new AppError('Aprendiz no encontrado.', 404);
      if (aprendiz.estado !== 'activo') throw new AppError(`La cuenta de ${aprendiz.nombre} no está activa.`, 409);
      const vigente = await client.query("SELECT estado FROM beneficios WHERE usuario_id = $1 AND estado <> 'finalizado';", [
        aprendiz.id,
      ]);
      if (vigente.rows[0]) {
        throw new AppError(
          `${aprendiz.nombre} ya ${vigente.rows[0].estado === 'activo' ? 'es beneficiario' : 'está en la lista de espera'}.`,
          409
        );
      }

      const { disponibles } = await estadoCupo(client);
      const estado = disponibles > 0 ? 'activo' : 'en_espera';
      const insertRes = await client.query(
        `INSERT INTO beneficios (usuario_id, estado, fecha_inicio, fecha_fin, prioridad, sin_apoyo_incompatible, creado_por)
         VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id;`,
        [aprendiz.id, estado, data.fecha_inicio, data.fecha_fin, data.prioridad, req.user!.id]
      );
      const creado = formatear(
        (await client.query(`SELECT ${COLUMNAS_BENEFICIO} ${FROM_BENEFICIO} WHERE b.id = $1;`, [insertRes.rows[0].id])).rows[0]
      );
      await registrarAuditoria(
        { usuario: req.user, accion: 'crear', entidad: 'beneficio', entidadId: creado.id, despues: creado },
        client
      );
      return creado;
    });

    return res.status(201).json({
      message:
        beneficio.estado === 'activo'
          ? `${beneficio.nombre} ya es beneficiario: desde ahora ve el almuerzo en $0.`
          : `El cupo de beneficiarios está lleno: ${beneficio.nombre} quedó en la lista de espera.`,
      beneficio,
    });
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/beneficiarios/:id — body: { prioridad?, fecha_fin? } de un beneficio vigente. */
export const editarBeneficio = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del beneficio no es válido.');
    const data = editarSchema.parse(req.body ?? {});
    const beneficio = await withTransaction(async (client) => {
      const actualRes = await client.query(`SELECT ${COLUMNAS_BENEFICIO} ${FROM_BENEFICIO} WHERE b.id = $1 FOR UPDATE OF b;`, [id]);
      const actual = actualRes.rows[0];
      if (!actual) throw new AppError('Beneficio no encontrado.', 404);
      if (actual.estado === 'finalizado') throw new AppError('Un beneficio finalizado no se puede editar.', 409);
      const fechaFin = data.fecha_fin === undefined ? actual.fecha_fin : data.fecha_fin;
      if (fechaFin && fechaFin < actual.fecha_inicio) {
        throw new AppError('La fecha de fin no puede ser anterior a la fecha de inicio.', 400);
      }
      await client.query('UPDATE beneficios SET prioridad = $1, fecha_fin = $2 WHERE id = $3;', [
        data.prioridad ?? actual.prioridad,
        fechaFin,
        id,
      ]);
      const nuevo = formatear((await client.query(`SELECT ${COLUMNAS_BENEFICIO} ${FROM_BENEFICIO} WHERE b.id = $1;`, [id])).rows[0]);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'editar',
          entidad: 'beneficio',
          entidadId: id,
          antes: { prioridad: actual.prioridad, fecha_fin: actual.fecha_fin },
          despues: { prioridad: nuevo.prioridad, fecha_fin: nuevo.fecha_fin },
        },
        client
      );
      return nuevo;
    });
    return res.json({ message: 'Beneficio actualizado.', beneficio });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/beneficiarios/:id/activar — el encargado confirma a un aprendiz de la lista de espera
 * cuando hay cupo (el sistema sugiere al primero). Su beneficio empieza hoy.
 */
export const activarDesdeEspera = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del beneficio no es válido.');
    await alDia();
    const beneficio = await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('beneficios_cupo'));");
      const actualRes = await client.query(`SELECT ${COLUMNAS_BENEFICIO} ${FROM_BENEFICIO} WHERE b.id = $1 FOR UPDATE OF b;`, [id]);
      const actual = actualRes.rows[0];
      if (!actual) throw new AppError('Beneficio no encontrado.', 404);
      if (actual.estado !== 'en_espera') throw new AppError('Solo se puede activar a un aprendiz de la lista de espera.', 409);
      if (actual.estado_cuenta !== 'activo') throw new AppError(`La cuenta de ${actual.nombre} no está activa.`, 409);
      const { disponibles, cupo } = await estadoCupo(client);
      if (disponibles === 0) throw new AppError(`El cupo de ${cupo} beneficiarios está lleno: primero finaliza otro beneficio.`, 409);

      const hoy = fechaBogota();
      await client.query(
        `UPDATE beneficios SET estado = 'activo', fecha_inicio = $2,
                fecha_fin = CASE WHEN fecha_fin IS NOT NULL AND fecha_fin < $2 THEN NULL ELSE fecha_fin END
         WHERE id = $1;`,
        [id, hoy]
      );
      const nuevo = formatear((await client.query(`SELECT ${COLUMNAS_BENEFICIO} ${FROM_BENEFICIO} WHERE b.id = $1;`, [id])).rows[0]);
      const sugerido = await client.query(
        `SELECT b.id FROM beneficios b JOIN usuarios u ON u.id = b.usuario_id
         WHERE b.estado = 'en_espera' AND u.estado = 'activo' AND b.id <> $1 ORDER BY ${ORDEN_ESPERA} LIMIT 1;`,
        [id]
      );
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'promover',
          entidad: 'beneficio',
          entidadId: id,
          antes: { estado: 'en_espera', prioridad: actual.prioridad },
          despues: { estado: 'activo', fecha_inicio: hoy, siguiente_en_espera: sugerido.rows[0]?.id ?? null },
        },
        client
      );
      return nuevo;
    });
    return res.json({ message: `${beneficio.nombre} pasó de la lista de espera a beneficiario activo.`, beneficio });
  } catch (error) {
    next(error);
  }
};

/** POST /api/beneficiarios/:id/finalizar — body: { motivo, detalle? }. Libera el cupo si estaba activo. */
export const finalizar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del beneficio no es válido.');
    const { motivo, detalle } = finalizarSchema.parse(req.body ?? {});
    const resultado = await withTransaction(async (client) => {
      const fila = await finalizarBeneficio(client, { beneficioId: id, motivo, detalle, usuario: req.user });
      if (!fila) {
        const existe = await client.query('SELECT 1 FROM beneficios WHERE id = $1;', [id]);
        throw existe.rowCount ? new AppError('El beneficio ya estaba finalizado.', 409) : new AppError('Beneficio no encontrado.', 404);
      }
      const nombre = (await client.query('SELECT nombre FROM usuarios WHERE id = $1;', [fila.usuario_id])).rows[0]?.nombre;
      return { ...fila, nombre, sugerido: fila.estado_anterior === 'activo' ? await primeroEnEspera(client) : null };
    });
    const sugerencia = resultado.sugerido
      ? ` Se liberó un cupo: el sistema sugiere a ${resultado.sugerido.nombre} (primero de la lista de espera).`
      : '';
    return res.json({
      message: `Finalizó el beneficio de ${resultado.nombre} (${MOTIVOS_FIN[motivo].toLowerCase()}).${sugerencia}`,
      sugerido: resultado.sugerido ? { beneficio_id: resultado.sugerido.id, nombre: resultado.sugerido.nombre } : null,
    });
  } catch (error) {
    next(error);
  }
};
