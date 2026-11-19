import { Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

/**
 * GET /api/dashboard/encargado
 * Indicadores del encabezado del panel del Encargado ("hoy" en hora de Colombia).
 * Ventas e ingresos de hoy suman las reservas y los Almuerzos Invitados (ADR 016).
 * Acceso: encargado
 */
export const getResumenEncargado = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT
         (SELECT COUNT(*) FROM ventas v
           WHERE v.estado = 'completada'
             AND DATE(v.fecha_hora AT TIME ZONE 'America/Bogota') = (NOW() AT TIME ZONE 'America/Bogota')::date
         )::int as ventas_hoy,
         (SELECT COALESCE(SUM(v.precio_cobrado), 0) FROM ventas v
           WHERE v.estado = 'completada' AND v.estado_pago = 'pagado'
             AND DATE(v.fecha_hora AT TIME ZONE 'America/Bogota') = (NOW() AT TIME ZONE 'America/Bogota')::date
         )::float8 as ingresos_hoy,
         (SELECT COALESCE(SUM(a.cantidad), 0) FROM almuerzos_invitados a
           WHERE DATE(a.fecha_hora AT TIME ZONE 'America/Bogota') = (NOW() AT TIME ZONE 'America/Bogota')::date
         )::int as invitados_hoy,
         (SELECT COALESCE(SUM(a.total), 0) FROM almuerzos_invitados a
           WHERE DATE(a.fecha_hora AT TIME ZONE 'America/Bogota') = (NOW() AT TIME ZONE 'America/Bogota')::date
         )::float8 as ingresos_invitados_hoy,
         (SELECT COALESCE(SUM(v.precio_cobrado), 0) FROM ventas v
           WHERE v.estado = 'completada' AND v.estado_pago = 'pendiente'
             AND DATE(v.fecha_hora AT TIME ZONE 'America/Bogota') = (NOW() AT TIME ZONE 'America/Bogota')::date
         )::float8 as por_cobrar_hoy,
         (SELECT COALESCE(SUM(d.monto), 0) FROM deudas d
           WHERE d.estado != 'pagada' AND d.monto > 0
         )::float8 as deudas_monto,
         (SELECT COUNT(*) FROM deudas d
           WHERE d.estado != 'pagada' AND d.monto > 0
         )::int as deudas_cantidad,
         (SELECT COUNT(*) FROM sugerencias s WHERE s.estado = 'pendiente')::int as sugerencias_pendientes,
         (SELECT COUNT(*) FROM usuarios u
           WHERE u.rol = 'aprendiz' AND u.es_beneficiario = true AND u.activo = true
         )::int as beneficiarios,
         (SELECT COUNT(*) FROM alertas al WHERE al.leida = false)::int as alertas_pendientes,
         EXISTS (SELECT 1 FROM cierres_caja c
           WHERE c.estado = 'cerrado' AND c.fecha = (NOW() AT TIME ZONE 'America/Bogota')::date) as caja_cerrada_hoy;`
    );

    const row = result.rows[0];
    return res.json({
      ventasHoy: row.ventas_hoy + row.invitados_hoy,
      ingresosHoy: row.ingresos_hoy + row.ingresos_invitados_hoy,
      invitadosHoy: row.invitados_hoy,
      ingresosInvitadosHoy: row.ingresos_invitados_hoy,
      porCobrarHoy: row.por_cobrar_hoy,
      deudasPendientes: { monto: row.deudas_monto, cantidad: row.deudas_cantidad },
      sugerenciasPendientes: row.sugerencias_pendientes,
      beneficiariosActivos: row.beneficiarios,
      alertasPendientes: row.alertas_pendientes,
      cajaCerradaHoy: row.caja_cerrada_hoy,
    });
  } catch (error) {
    next(error);
  }
};
