import type pg from 'pg';
import { pool } from '../db/index.js';
import { restarDias } from '../utils/rango.js';
import { obtenerConfiguracion } from './configuracion.service.js';

type Queryable = Pick<pg.PoolClient, 'query'>;

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** Plural del día para el texto: "los últimos 4 lunes", "los últimos 4 sábados". */
const PLURAL_DIA = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

/** Días comparables mínimos para sugerir (con menos, "Aún no hay datos suficientes"). */
export const MINIMO_DIAS_COMPARABLES = 2;

export interface Sugerencia {
  fecha: string;
  dia_semana: string;
  semanas: number;
  margen_pct: number;
  dias: { fecha: string; almuerzos: number }[];
  dias_con_datos: number;
  promedio: number | null;
  sugerencia: number | null;
  suficiente: boolean;
  mensaje: string;
}

/**
 * Sin IA (ADR 024): promedio de almuerzos vendidos (reservas, beneficiarios e invitados) de los
 * últimos N mismos días de la semana, más un margen, redondeado hacia arriba. Un día cuenta como
 * comparable si ese día se vendió al menos un almuerzo (los festivos o días sin servicio no bajan
 * el promedio). Las reservas cuentan por la fecha del menú; los invitados, por la fecha del registro.
 */
export function calcularSugerencia(
  fecha: string,
  ventasPorDia: Map<string, number>,
  opciones: { semanas: number; margenPct: number }
): Sugerencia {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  const dias = Array.from({ length: opciones.semanas }, (_, i) => {
    const f = restarDias(fecha, 7 * (i + 1));
    return { fecha: f, almuerzos: ventasPorDia.get(f) ?? 0 };
  });
  const conDatos = dias.filter((d) => d.almuerzos > 0);
  const suficiente = conDatos.length >= MINIMO_DIAS_COMPARABLES;
  const promedio = suficiente ? conDatos.reduce((s, d) => s + d.almuerzos, 0) / conDatos.length : null;
  // Se redondea el producto a 6 decimales antes del techo para que 22 × 1.1 no dé 25 por el punto flotante
  const sugerencia = promedio === null ? null : Math.ceil(Number((promedio * (1 + opciones.margenPct / 100)).toFixed(6)));
  const promedioTexto = promedio === null ? '' : Number(promedio.toFixed(1)).toLocaleString('es-CO');
  return {
    fecha,
    dia_semana: DIAS_SEMANA[diaSemana],
    semanas: opciones.semanas,
    margen_pct: opciones.margenPct,
    dias,
    dias_con_datos: conDatos.length,
    promedio: promedio === null ? null : Number(promedio.toFixed(2)),
    sugerencia,
    suficiente,
    mensaje: suficiente
      ? `Sugerencia: preparar ${sugerencia} almuerzos (promedio de los últimos ${conDatos.length} ${PLURAL_DIA[diaSemana]}: ${promedioTexto})`
      : 'Aún no hay datos suficientes',
  };
}

/** Almuerzos vendidos por día (Colombia) en las fechas indicadas. */
async function ventasDeFechas(fechas: string[], db: Queryable): Promise<Map<string, number>> {
  const res = await db.query(
    `SELECT TO_CHAR(d.fecha, 'YYYY-MM-DD') AS fecha,
            (SELECT COUNT(*) FROM ventas v JOIN menus_dia m ON m.id = v.menu_id
              WHERE v.estado = 'completada' AND m.fecha = d.fecha)
          + (SELECT COALESCE(SUM(a.cantidad), 0) FROM almuerzos_invitados a
              WHERE (a.fecha_hora AT TIME ZONE 'America/Bogota')::date = d.fecha) AS almuerzos
     FROM unnest($1::date[]) AS d(fecha);`,
    [fechas]
  );
  return new Map(res.rows.map((r) => [r.fecha as string, Number(r.almuerzos)]));
}

/** Sugerencia para una fecha con el margen y las semanas de la configuración. */
export async function sugerenciaParaFecha(fecha: string, db: Queryable = pool): Promise<Sugerencia> {
  const config = await obtenerConfiguracion(db);
  const semanas = config.sugerencia_semanas;
  const fechas = Array.from({ length: semanas }, (_, i) => restarDias(fecha, 7 * (i + 1)));
  const ventas = await ventasDeFechas(fechas, db);
  return calcularSugerencia(fecha, ventas, { semanas, margenPct: config.sugerencia_margen_pct });
}
