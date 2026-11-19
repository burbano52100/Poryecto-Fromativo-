import type pg from 'pg';
import { pool } from '../db/index.js';

/**
 * Parámetros que el encargado ajusta sin desplegar (tabla configuracion, migración 009).
 * Los valores por defecto coinciden con los que inserta la migración.
 */
export const CONFIGURACION_POR_DEFECTO = {
  beneficiarios_cupo_maximo: 50,
  sugerencia_margen_pct: 10,
  sugerencia_semanas: 4,
} as const;

export type ClaveConfiguracion = keyof typeof CONFIGURACION_POR_DEFECTO;
export type Configuracion = Record<ClaveConfiguracion, number>;

/** Rango válido de cada parámetro (enteros). */
export const LIMITES_CONFIGURACION: Record<ClaveConfiguracion, { min: number; max: number; etiqueta: string }> = {
  beneficiarios_cupo_maximo: { min: 1, max: 5000, etiqueta: 'El cupo máximo de beneficiarios' },
  sugerencia_margen_pct: { min: 0, max: 100, etiqueta: 'El margen de la sugerencia' },
  sugerencia_semanas: { min: 2, max: 12, etiqueta: 'El número de semanas de la sugerencia' },
};

type Queryable = Pick<pg.PoolClient, 'query'>;

export async function obtenerConfiguracion(db: Queryable = pool): Promise<Configuracion> {
  const res = await db.query<{ clave: string; valor: unknown }>('SELECT clave, valor FROM configuracion;');
  const config: Configuracion = { ...CONFIGURACION_POR_DEFECTO };
  for (const fila of res.rows) {
    if (fila.clave in config && typeof fila.valor === 'number') {
      config[fila.clave as ClaveConfiguracion] = fila.valor;
    }
  }
  return config;
}
