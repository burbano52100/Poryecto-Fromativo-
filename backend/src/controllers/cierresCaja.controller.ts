import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { fechaBogota, fechaLegible } from '../utils/horario.js';
import { fechaSchema, rangoCampos, resolverRango } from '../utils/rango.js';
import { withTransaction } from '../services/inventario.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import { resumenDia } from '../services/cierreCaja.service.js';

/**
 * Cierre de caja diario (ADR 021): resumen del día, efectivo recibido real y diferencia.
 * Un día cerrado bloquea reservas, invitados y pagos de esa fecha; reabrirlo exige motivo.
 */
const COLUMNAS_CIERRE = `c.id, TO_CHAR(c.fecha, 'YYYY-MM-DD') AS fecha,
  c.almuerzos_aprendices, c.almuerzos_beneficiarios, c.almuerzos_instructores,
  c.almuerzos_invitados_instructores, c.almuerzos_invitados_aprendices, c.almuerzos_invitados_corrientes,
  c.ingresos_esperados::float8 AS ingresos_esperados, c.ingresos_recibidos::float8 AS ingresos_recibidos,
  c.diferencia::float8 AS diferencia, c.detalle, c.observaciones, c.estado,
  c.fecha_hora_cierre, uc.nombre AS cerrado_por, c.fecha_hora_reapertura, ur.nombre AS reabierto_por,
  c.motivo_reapertura`;

const SELECT_CIERRE = `SELECT ${COLUMNAS_CIERRE}
  FROM cierres_caja c
  LEFT JOIN usuarios uc ON uc.id = c.cerrado_por
  LEFT JOIN usuarios ur ON ur.id = c.reabierto_por`;

const formatear = (c: Record<string, any>): Record<string, any> => ({
  ...c,
  fecha_hora_cierre: c.fecha_hora_cierre ? new Date(c.fecha_hora_cierre).toISOString() : null,
  fecha_hora_reapertura: c.fecha_hora_reapertura ? new Date(c.fecha_hora_reapertura).toISOString() : null,
});

/** La fecha de un cierre no puede ser futura (hora de Colombia). */
const fechaCierreSchema = fechaSchema('La fecha').refine((f) => f <= fechaBogota(), 'No puedes cerrar la caja de un día futuro.');

const cerrarSchema = z.object({
  fecha: fechaCierreSchema.optional(),
  ingresos_recibidos: z
    .number({ error: 'Escribe el efectivo recibido (un número).' })
    .min(0, 'El efectivo recibido no puede ser negativo.')
    .max(1_000_000_000, 'El efectivo recibido es demasiado alto.'),
  observaciones: z.string().trim().max(500, 'Las observaciones no pueden superar 500 caracteres.').nullish(),
});

const reabrirSchema = z.object({
  motivo: z
    .string({ error: 'Escribe el motivo de la reapertura.' })
    .trim()
    .min(5, 'Escribe el motivo de la reapertura (mínimo 5 caracteres).')
    .max(300, 'El motivo no puede superar 300 caracteres.'),
});

/** GET /api/cierres-caja/resumen?fecha= — resumen calculado del día y su cierre, si existe. */
export const getResumenCierre = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fecha = fechaBogota() } = z.object({ fecha: fechaSchema('La fecha').optional() }).parse(req.query);
    const [resumen, cierre] = await Promise.all([resumenDia(fecha), query(`${SELECT_CIERRE} WHERE c.fecha = $1;`, [fecha])]);
    return res.json({ ...resumen, cierre: cierre.rows[0] ? formatear(cierre.rows[0]) : null });
  } catch (error) {
    next(error);
  }
};

/** GET /api/cierres-caja?desde=&hasta= — historial (por defecto, los últimos 30 días). */
export const getHistorialCierres = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { desde, hasta } = resolverRango(z.object(rangoCampos).parse(req.query), 30);
    const result = await query(`${SELECT_CIERRE} WHERE c.fecha BETWEEN $1 AND $2 ORDER BY c.fecha DESC;`, [desde, hasta]);
    return res.json({ desde, hasta, items: result.rows.map(formatear) });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/cierres-caja — body: { fecha?, ingresos_recibidos, observaciones? }.
 * Cierra el día (hoy por defecto) con el resumen calculado en ese momento. Un cierre reabierto
 * se vuelve a cerrar con los datos actualizados.
 */
export const cerrarDia = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = cerrarSchema.parse(req.body ?? {});
    const fecha = data.fecha ?? fechaBogota();

    const cierre = await withTransaction(async (client) => {
      // Bloquea la fecha para que dos cierres simultáneos no se crucen
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1));', [`cierre:${fecha}`]);
      const existente = await client.query(`${SELECT_CIERRE} WHERE c.fecha = $1;`, [fecha]);
      const anterior = existente.rows[0];
      if (anterior?.estado === 'cerrado') throw new AppError(`La caja del ${fechaLegible(fecha)} ya está cerrada.`, 409);

      const resumen = await resumenDia(fecha, client);
      const valores = [
        fecha,
        resumen.almuerzos.aprendices,
        resumen.almuerzos.beneficiarios,
        resumen.almuerzos.instructores,
        resumen.almuerzos.invitados_instructores,
        resumen.almuerzos.invitados_aprendices,
        resumen.almuerzos.invitados_corrientes,
        resumen.ingresos_esperados,
        data.ingresos_recibidos,
        JSON.stringify(resumen.ingresos),
        data.observaciones || null,
        req.user!.id,
      ];
      await client.query(
        `INSERT INTO cierres_caja (fecha, almuerzos_aprendices, almuerzos_beneficiarios, almuerzos_instructores,
           almuerzos_invitados_instructores, almuerzos_invitados_aprendices, almuerzos_invitados_corrientes,
           ingresos_esperados, ingresos_recibidos, detalle, observaciones, cerrado_por, estado, fecha_hora_cierre)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, 'cerrado', NOW())
         ON CONFLICT (fecha) DO UPDATE SET
           almuerzos_aprendices = EXCLUDED.almuerzos_aprendices,
           almuerzos_beneficiarios = EXCLUDED.almuerzos_beneficiarios,
           almuerzos_instructores = EXCLUDED.almuerzos_instructores,
           almuerzos_invitados_instructores = EXCLUDED.almuerzos_invitados_instructores,
           almuerzos_invitados_aprendices = EXCLUDED.almuerzos_invitados_aprendices,
           almuerzos_invitados_corrientes = EXCLUDED.almuerzos_invitados_corrientes,
           ingresos_esperados = EXCLUDED.ingresos_esperados,
           ingresos_recibidos = EXCLUDED.ingresos_recibidos,
           detalle = EXCLUDED.detalle,
           observaciones = EXCLUDED.observaciones,
           cerrado_por = EXCLUDED.cerrado_por,
           estado = 'cerrado',
           fecha_hora_cierre = NOW();`,
        valores
      );
      const nuevo = formatear((await client.query(`${SELECT_CIERRE} WHERE c.fecha = $1;`, [fecha])).rows[0]);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'cerrar',
          entidad: 'cierre_caja',
          entidadId: nuevo.id,
          antes: anterior ? formatear(anterior) : null,
          despues: nuevo,
        },
        client
      );
      return nuevo;
    });

    const diferencia = cierre.diferencia as number;
    const textoDiferencia =
      diferencia === 0 ? 'sin diferencias' : diferencia > 0 ? `con un sobrante de $${diferencia.toLocaleString('es-CO')}` : `con un faltante de $${Math.abs(diferencia).toLocaleString('es-CO')}`;
    return res.status(201).json({ message: `Caja del ${fechaLegible(fecha)} cerrada ${textoDiferencia}.`, cierre });
  } catch (error) {
    next(error);
  }
};

/** POST /api/cierres-caja/:fecha/reabrir — body: { motivo }. Queda en la auditoría. */
export const reabrirDia = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const fecha = fechaSchema('La fecha').parse(req.params.fecha);
    const { motivo } = reabrirSchema.parse(req.body ?? {});
    const cierre = await withTransaction(async (client) => {
      const existente = await client.query(`${SELECT_CIERRE} WHERE c.fecha = $1 FOR UPDATE OF c;`, [fecha]);
      const anterior = existente.rows[0];
      if (!anterior) throw new AppError(`La caja del ${fechaLegible(fecha)} no se ha cerrado.`, 404);
      if (anterior.estado !== 'cerrado') throw new AppError(`La caja del ${fechaLegible(fecha)} ya está abierta.`, 409);
      await client.query(
        `UPDATE cierres_caja
         SET estado = 'reabierto', reabierto_por = $2, fecha_hora_reapertura = NOW(), motivo_reapertura = $3
         WHERE fecha = $1;`,
        [fecha, req.user!.id, motivo]
      );
      const nuevo = formatear((await client.query(`${SELECT_CIERRE} WHERE c.fecha = $1;`, [fecha])).rows[0]);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'reabrir',
          entidad: 'cierre_caja',
          entidadId: nuevo.id,
          antes: { estado: 'cerrado' },
          despues: { estado: 'reabierto', motivo },
        },
        client
      );
      return nuevo;
    });
    return res.json({ message: `Se reabrió la caja del ${fechaLegible(fecha)}.`, cierre });
  } catch (error) {
    next(error);
  }
};
