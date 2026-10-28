/**
 * setup.ts — Configuración global de tests de integración GastroSENA
 *
 * Reglas de seguridad:
 * - DATABASE_URL_TEST DEBE estar definida y SER DISTINTA de DATABASE_URL
 * - Si son iguales o DATABASE_URL_TEST no existe, los tests se niegan a correr
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { afterAll } from 'vitest';

dotenv.config();

const testUrl = process.env.DATABASE_URL_TEST;
const prodUrl = process.env.DATABASE_URL;

if (!testUrl) {
  throw new Error(
    '❌  DATABASE_URL_TEST no está definida. ' +
    'Define esta variable en backend/.env apuntando a una base de datos DISTINTA (ej: gastrosena_test).'
  );
}

if (testUrl === prodUrl) {
  throw new Error(
    '❌  DATABASE_URL_TEST es igual a DATABASE_URL. ' +
    'Los tests deben usar una base de datos separada para no destruir datos de producción/desarrollo.'
  );
}

// Pool de test — se comparte en todos los archivos de test
export const testPool = new Pool({ connectionString: testUrl });

/**
 * Limpia las tablas en orden correcto (respetando FK constraints) antes de cada suite.
 */
export async function cleanDatabase(): Promise<void> {
  await testPool.query(`
    TRUNCATE TABLE
      pagos_deuda,
      movimientos_saldo,
      mermas,
      movimientos_kardex,
      receta_ingredientes,
      recetas,
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

/**
 * Cierra el pool al terminar todos los tests.
 */
afterAll(async () => {
  await testPool.end();
});
