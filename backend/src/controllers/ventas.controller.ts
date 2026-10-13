import { Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const getVentasReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || 'Semana';

    let interval = "interval '7 days'";
    if (period.toLowerCase() === 'día' || period.toLowerCase() === 'dia') interval = "interval '1 day'";
    else if (period.toLowerCase() === 'mes') interval = "interval '30 days'";
    else if (period.toLowerCase() === 'trimestre') interval = "interval '90 days'";
    else if (period.toLowerCase() === 'semestre') interval = "interval '180 days'";
    else if (period.toLowerCase() === 'año' || period.toLowerCase() === 'ano') interval = "interval '365 days'";

    const totalsRes = await query(
      `SELECT COUNT(*)::int as total_ventas,
              COALESCE(SUM(precio_cobrado), 0)::numeric as total_ingresos
       FROM ventas
       WHERE estado = 'completada'
         AND fecha_hora >= NOW() - ${interval};`
    );

    const totalVentas = totalsRes.rows[0]?.total_ventas || 0;
    const totalIngresos = Number(totalsRes.rows[0]?.total_ingresos || 0);

    const breakdownRes = await query(
      `SELECT TO_CHAR(fecha_hora, 'Dy') as day_abbr,
              DATE(fecha_hora) as dia_fecha,
              COUNT(*)::int as count,
              COALESCE(SUM(precio_cobrado), 0)::numeric as total
       FROM ventas
       WHERE estado = 'completada'
         AND fecha_hora >= NOW() - ${interval}
       GROUP BY TO_CHAR(fecha_hora, 'Dy'), DATE(fecha_hora)
       ORDER BY DATE(fecha_hora) ASC
       LIMIT 7;`
    );

    const maxCount = breakdownRes.rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;

    const breakdown = breakdownRes.rows.map((row) => ({
      day: row.day_abbr,
      count: row.count,
      total: `$${Number(row.total).toLocaleString('es-CO')}`,
      percent: `${Math.round((row.count / maxCount) * 100)}%`,
    }));

    const recentRes = await query(
      `SELECT v.id, v.fecha_hora, v.precio_cobrado, v.metodo_pago,
              u.nombre as usuario_nombre, u.cedula, u.rol,
              m.nombre as menu_nombre
       FROM ventas v
       JOIN usuarios u ON v.usuario_id = u.id
       JOIN menus_dia m ON v.menu_id = m.id
       ORDER BY v.fecha_hora DESC
       LIMIT 20;`
    );

    return res.json({
      period,
      totalVentas,
      totalIngresos,
      breakdown,
      transacciones: recentRes.rows.map((v) => ({
        id: v.id,
        fecha: v.fecha_hora,
        cliente: v.usuario_nombre,
        cedula: v.cedula,
        rol: v.rol,
        menu: v.menu_nombre,
        precio: Number(v.precio_cobrado),
        metodo_pago: v.metodo_pago,
      })),
    });
  } catch (error) {
    next(error);
  }
};
