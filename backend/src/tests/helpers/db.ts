import { pool } from '../../db/index.js';

/**
 * Limpia las tablas en orden correcto (respetando FK constraints) antes de cada suite.
 * Usa el mismo pool que la app, que en NODE_ENV=test apunta a DATABASE_URL_TEST.
 */
export async function cleanDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      pagos_deuda,
      movimientos_saldo,
      mermas,
      movimientos_kardex,
      receta_ingredientes,
      recetas,
      compra_detalle,
      compras,
      visitas_institucionales,
      ventas,
      deudas,
      sugerencias,
      menus_dia,
      reconocimiento_facial,
      usuarios,
      fichas,
      materiales,
      categorias_material,
      instituciones
    RESTART IDENTITY CASCADE;
  `);
}
