import type pg from 'pg';
import { pool } from '../db/index.js';
import { AppError } from '../middleware/error.middleware.js';
import { fechaLegible } from '../utils/horario.js';
import { entreDiasBogota } from '../utils/rango.js';

type Queryable = Pick<pg.PoolClient, 'query'>;

/** Fecha en Colombia ('YYYY-MM-DD') de una columna timestamptz, para usar en SQL. */
export const fechaBogotaSql = (columna: string) => `(${columna} AT TIME ZONE 'America/Bogota')::date`;

/**
 * Un día con la caja cerrada no admite crear, editar ni eliminar reservas, registros de
 * invitados ni pagos de esa fecha (ADR 021). Responde 409 con un mensaje claro.
 */
export async function verificarDiaAbierto(fecha: string, db: Queryable = pool): Promise<void> {
  const res = await db.query("SELECT 1 FROM cierres_caja WHERE fecha = $1 AND estado = 'cerrado';", [fecha]);
  if (res.rowCount) {
    throw new AppError(
      `La caja del ${fechaLegible(fecha)} está cerrada: no se pueden registrar ni cambiar ventas, invitados ni pagos de esa fecha. Para corregir algo, reabre el cierre.`,
      409
    );
  }
}

/** Fechas cerradas dentro de un rango, para deshabilitar acciones en la interfaz. */
export async function fechasCerradas(desde: string, hasta: string, db: Queryable = pool): Promise<string[]> {
  const res = await db.query(
    `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha FROM cierres_caja
     WHERE estado = 'cerrado' AND fecha BETWEEN $1 AND $2 ORDER BY fecha;`,
    [desde, hasta]
  );
  return res.rows.map((r) => r.fecha as string);
}

export interface ResumenDia {
  fecha: string;
  almuerzos: {
    aprendices: number;
    beneficiarios: number;
    instructores: number;
    invitados_instructores: number;
    invitados_aprendices: number;
    invitados_corrientes: number;
    total: number;
  };
  ingresos: {
    /** Reservas de aprendices (no beneficiarios) del día pagadas en efectivo en la caja (antes del QR). */
    aprendices: number;
    aprendices_pagados: number;
    aprendices_pendientes: number;
    /** Almuerzos Invitados: se pagan al registrarlos. */
    invitados: number;
    /** Abonos de instructores a la Cartera de Deudas recibidos ese día. */
    pagos_deuda: number;
    /** Almuerzos de instructores pagados de contado en la ventanilla (ADR 026): entran a la caja. */
    instructores_contado: number;
    /** Consumo de instructores fiado: no entra a la caja ese día (informativo). */
    credito_instructores: number;
    /** Reservas pagadas con el código QR (ADR 027): el dinero llega a la cuenta, no a la caja. */
    qr_pagados: number;
    /** Reservas con QR sin pagar todavía: apartadas sin comprobante o en revisión (informativo). */
    qr_pendientes: number;
  };
  ingresos_esperados: number;
}

/**
 * Resumen de la caja de un día (hora de Colombia). Esperado en caja = reservas de aprendices en
 * efectivo (pagadas o no: el aprendiz paga al recoger) + almuerzos de instructores de contado
 * (ADR 026) + almuerzos invitados + abonos de deuda del día. Lo fiado no entra, ni lo pagado con
 * el código QR (ADR 027), que llega a la cuenta de Bancolombia y se informa aparte.
 */
export async function resumenDia(fecha: string, db: Queryable = pool): Promise<ResumenDia> {
  const res = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.estado = 'completada' AND u.rol = 'aprendiz' AND v.estado_pago <> 'gratis'
           AND ${entreDiasBogota('v.fecha_hora', '$1', '$1')})::int AS aprendices,
       (SELECT COUNT(*) FROM ventas v
         WHERE v.estado = 'completada' AND v.estado_pago = 'gratis'
           AND ${entreDiasBogota('v.fecha_hora', '$1', '$1')})::int AS beneficiarios,
       (SELECT COUNT(*) FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.estado = 'completada' AND u.rol = 'instructor' AND v.estado_pago <> 'gratis'
           AND ${entreDiasBogota('v.fecha_hora', '$1', '$1')})::int AS instructores,
       (SELECT COALESCE(SUM(v.precio_cobrado), 0) FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.estado = 'completada' AND u.rol = 'aprendiz' AND v.estado_pago <> 'gratis' AND v.metodo_pago <> 'qr'
           AND ${entreDiasBogota('v.fecha_hora', '$1', '$1')})::float8 AS ingresos_aprendices,
       (SELECT COALESCE(SUM(v.precio_cobrado), 0) FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.estado = 'completada' AND u.rol = 'aprendiz' AND v.estado_pago = 'pagado' AND v.metodo_pago <> 'qr'
           AND ${entreDiasBogota('v.fecha_hora', '$1', '$1')})::float8 AS aprendices_pagados,
       (SELECT COALESCE(SUM(v.precio_cobrado), 0) FROM ventas v
         WHERE v.estado = 'completada' AND v.metodo_pago = 'qr' AND v.estado_pago = 'pagado'
           AND ${entreDiasBogota('v.fecha_hora', '$1', '$1')})::float8 AS qr_pagados,
       (SELECT COALESCE(SUM(v.precio_cobrado), 0) FROM ventas v
         WHERE v.estado = 'completada' AND v.metodo_pago = 'qr' AND v.estado_pago = 'pendiente'
           AND ${entreDiasBogota('v.fecha_hora', '$1', '$1')})::float8 AS qr_pendientes,
       (SELECT COALESCE(SUM(v.precio_cobrado), 0) FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.estado = 'completada' AND u.rol = 'instructor' AND v.metodo_pago = 'credito'
           AND ${entreDiasBogota('v.fecha_hora', '$1', '$1')})::float8 AS credito_instructores,
       (SELECT COALESCE(SUM(v.precio_cobrado), 0) FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.estado = 'completada' AND u.rol = 'instructor' AND v.metodo_pago = 'efectivo'
           AND ${entreDiasBogota('v.fecha_hora', '$1', '$1')})::float8 AS instructores_contado,
       (SELECT COALESCE(SUM(p.monto_pagado), 0) FROM pagos_deuda p
         WHERE ${entreDiasBogota('p.fecha_pago', '$1', '$1')})::float8 AS pagos_deuda;`,
    [fecha]
  );
  const invitados = await db.query(
    `SELECT a.tipo, COALESCE(SUM(a.cantidad), 0)::int AS personas, COALESCE(SUM(a.total), 0)::float8 AS total
     FROM almuerzos_invitados a
     WHERE ${entreDiasBogota('a.fecha_hora', '$1', '$1')}
     GROUP BY a.tipo;`,
    [fecha]
  );
  const porTipo = (tipo: string) => invitados.rows.find((r) => r.tipo === tipo) ?? { personas: 0, total: 0 };
  const f = res.rows[0];
  const totalInvitados = invitados.rows.reduce((s, r) => s + Number(r.total), 0);

  const almuerzos = {
    aprendices: f.aprendices,
    beneficiarios: f.beneficiarios,
    instructores: f.instructores,
    invitados_instructores: porTipo('instructor').personas,
    invitados_aprendices: porTipo('aprendiz').personas,
    invitados_corrientes: porTipo('corriente').personas,
    total: 0,
  };
  almuerzos.total = Object.values(almuerzos).reduce((s, n) => s + n, 0);

  const ingresos = {
    aprendices: f.ingresos_aprendices,
    aprendices_pagados: f.aprendices_pagados,
    aprendices_pendientes: f.ingresos_aprendices - f.aprendices_pagados,
    invitados: totalInvitados,
    pagos_deuda: f.pagos_deuda,
    instructores_contado: f.instructores_contado,
    credito_instructores: f.credito_instructores,
    qr_pagados: f.qr_pagados,
    qr_pendientes: f.qr_pendientes,
  };
  return {
    fecha,
    almuerzos,
    ingresos,
    ingresos_esperados: ingresos.aprendices + ingresos.invitados + ingresos.pagos_deuda + ingresos.instructores_contado,
  };
}
