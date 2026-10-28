import pg from 'pg';
import { getClient } from '../db/index.js';
import { AppError } from '../middleware/error.middleware.js';

/** Decimales que admite stock_actual (NUMERIC(12,2)) en movimientos de stock. */
export const DECIMALES_STOCK = 2;
/** Decimales que admiten las cantidades de ingredientes (NUMERIC(12,3)). */
export const DECIMALES_INGREDIENTE = 3;

/** Expresión SQL del estado del material, calculado al leer (alias de tabla: m). */
export const ESTADO_MATERIAL_SQL = `
  CASE
    WHEN m.fecha_vencimiento IS NOT NULL
         AND m.fecha_vencimiento <= (NOW() AT TIME ZONE 'America/Bogota')::date + 5 THEN 'Venciendo'
    WHEN m.stock_actual <= m.stock_minimo * 0.5 THEN 'Crítico'
    WHEN m.stock_actual <= m.stock_minimo THEN 'Bajo'
    ELSE 'Bueno'
  END`;

type Queryable = Pick<pg.PoolClient, 'query'>;

export type TipoMovimientoStock = 'entrada' | 'salida' | 'merma';

export interface MovimientoInput {
  materialId: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  concepto: string;
  usuarioId: string | null;
  referenciaTipo?: string;
}

export interface MovimientoResultado {
  movimientoId: string;
  materialId: string;
  nombre: string;
  unidad: string;
  saldo: number;
}

const redondear = (valor: number, decimales: number): number => {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
};

/** Ejecuta fn dentro de una transacción con un cliente dedicado. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Registra un movimiento de stock: bloquea el material, actualiza stock_actual
 * e inserta el movimiento en el kardex con su saldo resultante.
 * Debe llamarse dentro de una transacción.
 */
export async function registrarMovimiento(
  client: pg.PoolClient,
  input: MovimientoInput
): Promise<MovimientoResultado> {
  const matRes = await client.query(
    `SELECT id, nombre, unidad_medida, stock_actual::float8 AS stock
     FROM materiales WHERE id = $1 AND activo = true FOR UPDATE;`,
    [input.materialId]
  );
  const material = matRes.rows[0];
  if (!material) {
    throw new AppError('Material no encontrado.', 404);
  }

  const delta = input.tipo === 'entrada' ? input.cantidad : -input.cantidad;
  const saldo = redondear(material.stock + delta, DECIMALES_STOCK);
  if (saldo < 0) {
    throw new AppError(
      `Stock insuficiente: ${material.nombre} tiene ${material.stock} ${material.unidad_medida} y se intentan descontar ${input.cantidad}.`,
      409
    );
  }

  await client.query('UPDATE materiales SET stock_actual = $1 WHERE id = $2;', [saldo, material.id]);

  // clock_timestamp() conserva el orden de varios movimientos dentro de una misma transacción
  const kardexRes = await client.query(
    `INSERT INTO movimientos_kardex
       (material_id, fecha_hora, usuario_id, tipo, concepto, cantidad_entrada, cantidad_salida, saldo_resultante, referencia_tipo)
     VALUES ($1, clock_timestamp(), $2, $3, $4, $5, $6, $7, $8)
     RETURNING id;`,
    [
      material.id,
      input.usuarioId,
      input.tipo,
      input.concepto,
      input.tipo === 'entrada' ? input.cantidad : null,
      input.tipo === 'entrada' ? null : input.cantidad,
      saldo,
      input.referenciaTipo ?? null,
    ]
  );

  return {
    movimientoId: kardexRes.rows[0].id,
    materialId: material.id,
    nombre: material.nombre,
    unidad: material.unidad_medida,
    saldo,
  };
}

/** Registra una merma con su movimiento de kardex enlazado. Debe llamarse dentro de una transacción. */
export async function registrarMerma(
  client: pg.PoolClient,
  input: { materialId: string; cantidad: number; razon: string; usuarioId: string | null }
) {
  const mov = await registrarMovimiento(client, {
    materialId: input.materialId,
    tipo: 'merma',
    cantidad: input.cantidad,
    concepto: `Merma: ${input.razon}`,
    usuarioId: input.usuarioId,
    referenciaTipo: 'merma',
  });

  const mermaRes = await client.query(
    `INSERT INTO mermas (material_id, cantidad_perdida, unidad, razon, registrado_por, movimiento_kardex_id, fecha_hora)
     VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())
     RETURNING id, TO_CHAR(fecha_hora AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH12:MI AM') AS date;`,
    [mov.materialId, input.cantidad, mov.unidad, input.razon, input.usuarioId, mov.movimientoId]
  );

  await client.query('UPDATE movimientos_kardex SET referencia_id = $1 WHERE id = $2;', [
    mermaRes.rows[0].id,
    mov.movimientoId,
  ]);

  return { id: mermaRes.rows[0].id as string, date: mermaRes.rows[0].date as string, movimiento: mov };
}

/** Recalcula el costo de los ingredientes y el costo de producción de una receta. */
export async function recalcularReceta(db: Queryable, recetaId: string): Promise<void> {
  await db.query(
    `UPDATE receta_ingredientes ri
     SET costo = ROUND(ri.cantidad * m.costo_unitario, 2), unidad = m.unidad_medida
     FROM materiales m
     WHERE m.id = ri.material_id AND ri.receta_id = $1;`,
    [recetaId]
  );
  await db.query(
    `UPDATE recetas
     SET costo_produccion = COALESCE((SELECT SUM(costo) FROM receta_ingredientes WHERE receta_id = $1), 0)
     WHERE id = $1;`,
    [recetaId]
  );
}

/** Recalcula todas las recetas que usan un material (tras cambiar su costo o unidad). */
export async function recalcularRecetasDeMaterial(db: Queryable, materialId: string): Promise<void> {
  const recetas = await db.query(
    'SELECT DISTINCT receta_id FROM receta_ingredientes WHERE material_id = $1;',
    [materialId]
  );
  for (const row of recetas.rows) {
    await recalcularReceta(db, row.receta_id);
  }
}
