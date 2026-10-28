/**
 * setup.ts — Configuración global de tests de integración GastroSENA
 *
 * Reglas de seguridad:
 * - DATABASE_URL_TEST DEBE estar definida y SER DISTINTA de DATABASE_URL
 * - Si son iguales o DATABASE_URL_TEST no existe, los tests se niegan a correr
 *   (la validación vive en db/index.ts y se activa con NODE_ENV=test)
 */
import dotenv from 'dotenv';
import { afterAll } from 'vitest';

process.env.NODE_ENV = 'test';
dotenv.config({ quiet: true });

const { pool } = await import('../db/index.js');

/**
 * Cierra el pool de la app al terminar cada archivo de test.
 */
afterAll(async () => {
  await pool.end();
});
