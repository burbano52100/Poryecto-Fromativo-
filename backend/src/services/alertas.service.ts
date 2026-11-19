import type pg from 'pg';
import { pool } from '../db/index.js';

/** Avisos para el encargado (tabla alertas, migración 009). */
export type TipoAlerta =
  | 'stock_insuficiente'
  | 'menu_sin_receta'
  | 'beneficio_finalizado'
  | 'beneficiario_inactivo'
  | 'cupo_liberado';

type Queryable = Pick<pg.PoolClient, 'query'>;

export async function crearAlerta(
  tipo: TipoAlerta,
  mensaje: string,
  datos: Record<string, unknown> | null = null,
  db: Queryable = pool
): Promise<void> {
  await db.query('INSERT INTO alertas (tipo, mensaje, datos) VALUES ($1, $2, $3::jsonb);', [
    tipo,
    mensaje,
    datos ? JSON.stringify(datos) : null,
  ]);
}
