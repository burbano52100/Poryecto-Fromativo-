import { Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { TIPOS_ALMUERZO_INVITADO, type TipoAlmuerzoInvitado } from '../config/almuerzosInvitados.js';

/**
 * Reporte de Ventas del Encargado: reservas de la app más los registros de Almuerzos Invitados.
 *
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

    // Almuerzos Invitados (ADR 016): se pagan al registrarlos, así que cuentan como cobrados
    const invitadosRes = await query<{ tipo: TipoAlmuerzoInvitado; personas: number; ingresos: number }>(
      `WITH ${rango}
       SELECT a.tipo,
              SUM(a.cantidad)::int as personas,
              SUM(a.total)::float8 as ingresos
       FROM almuerzos_invitados a, rango
       WHERE a.fecha_hora AT TIME ZONE 'America/Bogota' >= rango.inicio
       GROUP BY a.tipo;`
    );

    const breakdownRes = await query(
      `WITH ${rango},
       serie AS (
         SELECT generate_series(
           DATE_TRUNC('${unidad}', inicio), DATE_TRUNC('${unidad}', fin), interval '1 ${unidad}'
         ) AS bucket
         FROM rango
       ),
       reservas AS (
         SELECT DATE_TRUNC('${unidad}', v.fecha_hora AT TIME ZONE 'America/Bogota') AS bucket,
                COUNT(*) AS n,
                COALESCE(SUM(v.precio_cobrado) FILTER (WHERE v.estado_pago = 'pagado'), 0) AS ingresos
         FROM ventas v, rango
         WHERE v.estado = 'completada'
           AND v.fecha_hora AT TIME ZONE 'America/Bogota' >= rango.inicio
         GROUP BY 1
       ),
       invitados AS (
         SELECT DATE_TRUNC('${unidad}', a.fecha_hora AT TIME ZONE 'America/Bogota') AS bucket,
                SUM(a.cantidad) AS n,
                SUM(a.total) AS ingresos
         FROM almuerzos_invitados a, rango
         WHERE a.fecha_hora AT TIME ZONE 'America/Bogota' >= rango.inicio
         GROUP BY 1
       )
       SELECT TO_CHAR(s.bucket, 'YYYY-MM-DD') as fecha,
              (COALESCE(r.n, 0) + COALESCE(i.n, 0))::int as count,
              (COALESCE(r.ingresos, 0) + COALESCE(i.ingresos, 0))::float8 as ingresos,
              COALESCE(i.n, 0)::int as invitados
       FROM serie s
       LEFT JOIN reservas r ON r.bucket = s.bucket
       LEFT JOIN invitados i ON i.bucket = s.bucket
       ORDER BY s.bucket ASC;`
    );

    // Reservas y registros de Almuerzos Invitados, mezclados por fecha
    const transaccionesRes = await query(
      `WITH ${rango}
       SELECT * FROM (
         SELECT v.id, v.fecha_hora, v.precio_cobrado::float8 as precio, v.estado_pago::text as estado_pago,
                u.nombre as cliente, u.cedula, u.rol::text as rol,
                COALESCE(f.codigo_ficha, '') as ficha,
                m.nombre as menu,
                'reserva' as origen, 1 as personas
         FROM ventas v
         JOIN usuarios u ON v.usuario_id = u.id
         JOIN menus_dia m ON v.menu_id = m.id
         LEFT JOIN fichas f ON u.ficha_id = f.id,
         rango
         WHERE v.estado = 'completada'
           AND v.fecha_hora AT TIME ZONE 'America/Bogota' >= rango.inicio
         UNION ALL
         SELECT a.id, a.fecha_hora, a.total::float8, 'pagado',
                COALESCE(a.nombre_invitado, ''), '', a.tipo::text,
                '',
                'Almuerzo invitado',
                'invitado', a.cantidad
         FROM almuerzos_invitados a, rango
         WHERE a.fecha_hora AT TIME ZONE 'America/Bogota' >= rango.inicio
       ) t
       ORDER BY t.fecha_hora DESC
       LIMIT 100;`
    );

    const totales = totalsRes.rows[0];
    // Los tres tipos vienen siempre, aunque estén en cero
    const invitadosPorTipo = Object.fromEntries(
      TIPOS_ALMUERZO_INVITADO.map((tipo) => {
        const fila = invitadosRes.rows.find((r) => r.tipo === tipo);
        return [tipo, { personas: fila?.personas ?? 0, ingresos: fila?.ingresos ?? 0 }];
      })
    ) as Record<TipoAlmuerzoInvitado, { personas: number; ingresos: number }>;
    const invitados = Object.values(invitadosPorTipo).reduce(
      (acc, t) => ({ personas: acc.personas + t.personas, ingresos: acc.ingresos + t.ingresos }),
      { personas: 0, ingresos: 0 }
    );
    const maxCount = breakdownRes.rows.reduce((max, row) => Math.max(max, row.count), 0) || 1;

    return res.json({
      period,
      desde: totales.desde,
      agrupacion: unidad === 'month' ? 'mes' : 'dia',
      totales: {
        almuerzosServidos: totales.servidos + invitados.personas,
        almuerzosGratis: totales.gratis,
        ingresosCobrados: totales.cobrados + invitados.ingresos,
        porCobrar: totales.por_cobrar,
        almuerzosInvitados: invitados.personas,
        ingresosInvitados: invitados.ingresos,
        invitadosPorTipo,
      },
      breakdown: breakdownRes.rows.map((row) => ({
        fecha: row.fecha,
        label: etiquetaBucket(row.fecha, unidad),
        count: row.count,
        ingresos: row.ingresos,
        // Personas de Almuerzos Invitados incluidas en `count`
        invitados: row.invitados,
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
        // 'invitado': registro de Almuerzos Invitados; `rol` trae su tipo y `personas` cuántas fueron
        origen: v.origen,
        personas: v.personas,
      })),
    });
  } catch (error) {
    next(error);
  }
};
