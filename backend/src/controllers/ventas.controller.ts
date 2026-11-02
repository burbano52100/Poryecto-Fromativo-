import { Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

/**
 * Períodos "en curso" en hora de Colombia: Día = hoy, Semana = desde el lunes,
 * Mes = desde el 1°, y trimestre, semestre y año calendario.
 * Los fragmentos SQL salen de este mapa fijo, nunca del texto que envía el cliente.
 */
const PERIODOS = {
  dia: { inicio: "DATE_TRUNC('day', ahora)", unidad: 'day' },
  semana: { inicio: "DATE_TRUNC('week', ahora)", unidad: 'day' },
  mes: { inicio: "DATE_TRUNC('month', ahora)", unidad: 'day' },
  trimestre: { inicio: "DATE_TRUNC('quarter', ahora)", unidad: 'day' },
  semestre: {
    inicio:
      "MAKE_DATE(EXTRACT(YEAR FROM ahora)::int, CASE WHEN EXTRACT(MONTH FROM ahora) <= 6 THEN 1 ELSE 7 END, 1)::timestamp",
    unidad: 'month',
  },
  ano: { inicio: "DATE_TRUNC('year', ahora)", unidad: 'month' },
} as const;

type Periodo = keyof typeof PERIODOS;

/** Acepta 'Día', 'dia', 'Año', 'ano', etc. Devuelve null si el período no existe. */
const normalizarPeriodo = (valor: unknown): Periodo | null => {
  if (valor === undefined || valor === '') return 'semana';
  if (typeof valor !== 'string') return null;
  const limpio = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return limpio in PERIODOS ? (limpio as Periodo) : null;
};

const etiquetaBucket = (fecha: string, unidad: 'day' | 'month'): string => {
  const date = new Date(`${fecha}T12:00:00Z`);
  return unidad === 'month'
    ? date.toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    : date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
};

export const getVentasReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const period = normalizarPeriodo(req.query.period);
    if (!period) {
      return res.status(400).json({
        message: 'Período no válido. Usa: Día, Semana, Mes, Trimestre, Semestre o Año.',
      });
    }

    const { inicio, unidad } = PERIODOS[period];
    const rango = `rango AS (
      SELECT ${inicio} AS inicio, ahora AS fin
      FROM (SELECT NOW() AT TIME ZONE 'America/Bogota' AS ahora) a
    )`;

    const totalsRes = await query(
      `WITH ${rango}
       SELECT TO_CHAR((SELECT inicio FROM rango), 'YYYY-MM-DD') as desde,
              COUNT(v.id)::int as servidos,
              COUNT(v.id) FILTER (WHERE v.estado_pago = 'gratis')::int as gratis,
              COALESCE(SUM(v.precio_cobrado) FILTER (WHERE v.estado_pago = 'pagado'), 0)::float8 as cobrados,
              COALESCE(SUM(v.precio_cobrado) FILTER (WHERE v.estado_pago = 'pendiente'), 0)::float8 as por_cobrar
       FROM ventas v, rango
       WHERE v.estado = 'completada'
         AND v.fecha_hora AT TIME ZONE 'America/Bogota' >= rango.inicio;`
    );

    const breakdownRes = await query(
      `WITH ${rango},
       serie AS (
         SELECT generate_series(
           DATE_TRUNC('${unidad}', inicio), DATE_TRUNC('${unidad}', fin), interval '1 ${unidad}'
         ) AS bucket
         FROM rango
       )
       SELECT TO_CHAR(s.bucket, 'YYYY-MM-DD') as fecha,
              COUNT(v.id)::int as count,
              COALESCE(SUM(v.precio_cobrado) FILTER (WHERE v.estado_pago = 'pagado'), 0)::float8 as ingresos
       FROM serie s
       LEFT JOIN ventas v
         ON v.estado = 'completada'
        AND DATE_TRUNC('${unidad}', v.fecha_hora AT TIME ZONE 'America/Bogota') = s.bucket
       GROUP BY s.bucket
       ORDER BY s.bucket ASC;`
    );

    const transaccionesRes = await query(
      `WITH ${rango}
       SELECT v.id, v.fecha_hora, v.precio_cobrado::float8 as precio, v.estado_pago,
              u.nombre as cliente, u.cedula, u.rol,
              COALESCE(f.codigo_ficha, '') as ficha,
              m.nombre as menu
       FROM ventas v
       JOIN usuarios u ON v.usuario_id = u.id
       JOIN menus_dia m ON v.menu_id = m.id
       LEFT JOIN fichas f ON u.ficha_id = f.id,
       rango
       WHERE v.estado = 'completada'
         AND v.fecha_hora AT TIME ZONE 'America/Bogota' >= rango.inicio
       ORDER BY v.fecha_hora DESC
       LIMIT 100;`
    );

    const totales = totalsRes.rows[0];
    const maxCount = breakdownRes.rows.reduce((max, row) => Math.max(max, row.count), 0) || 1;

    return res.json({
      period,
      desde: totales.desde,
      agrupacion: unidad === 'month' ? 'mes' : 'dia',
      totales: {
        almuerzosServidos: totales.servidos,
        almuerzosGratis: totales.gratis,
        ingresosCobrados: totales.cobrados,
        porCobrar: totales.por_cobrar,
      },
      breakdown: breakdownRes.rows.map((row) => ({
        fecha: row.fecha,
        label: etiquetaBucket(row.fecha, unidad),
        count: row.count,
        ingresos: row.ingresos,
        percent: Math.round((row.count / maxCount) * 100),
      })),
      transacciones: transaccionesRes.rows.map((v) => ({
        id: v.id,
        fecha: new Date(v.fecha_hora).toISOString(),
        cliente: v.cliente,
        cedula: v.cedula,
        rol: v.rol,
        ficha: v.ficha,
        menu: v.menu,
        precio: v.precio,
        estado_pago: v.estado_pago,
        beneficiario: v.estado_pago === 'gratis',
      })),
    });
  } catch (error) {
    next(error);
  }
};
