import type pg from 'pg';
import bcrypt from 'bcryptjs';
import { pool } from '../db/index.js';

type Queryable = Pick<pg.PoolClient, 'query'>;

export const JORNADAS = ['mañana', 'tarde', 'noche'] as const;
export type Jornada = (typeof JORNADAS)[number];

/** Rondas de bcrypt de todas las contraseñas (igual que el registro). */
export const RONDAS_BCRYPT = 10;

/** Contraseña inicial de las cuentas creadas por el coordinador o restablecidas: la cédula (ADR 018). */
export const hashClaveInicial = (cedula: string): Promise<string> => bcrypt.hash(cedula, RONDAS_BCRYPT);

/** Programa por defecto de una ficha que se crea sin programa. */
export const PROGRAMA_POR_DEFECTO = 'Programa de Formación SENA';

/**
 * Devuelve la ficha con ese código o la crea con el programa y la jornada indicados.
 * Si ya existe no cambia sus datos.
 */
export async function buscarOCrearFicha(
  codigo: string,
  opciones: { programa?: string | null; jornada?: Jornada | null } = {},
  db: Queryable = pool
): Promise<{ id: string; codigo: string; creada: boolean }> {
  const existente = await db.query('SELECT id FROM fichas WHERE codigo_ficha = $1;', [codigo]);
  if (existente.rows[0]) return { id: existente.rows[0].id, codigo, creada: false };

  const nueva = await db.query(
    `INSERT INTO fichas (codigo_ficha, programa, jornada, cantidad_estudiantes)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (codigo_ficha) DO UPDATE SET codigo_ficha = EXCLUDED.codigo_ficha
     RETURNING id;`,
    [codigo, opciones.programa || PROGRAMA_POR_DEFECTO, opciones.jornada ?? 'mañana']
  );
  return { id: nueva.rows[0].id, codigo, creada: true };
}
