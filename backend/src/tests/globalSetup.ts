/**
 * globalSetup.ts — Se ejecuta una sola vez antes de todos los archivos de test.
 * Aplica las migraciones pendientes sobre la BD de test (DATABASE_URL_TEST).
 */
import dotenv from 'dotenv';

export default async function setup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  dotenv.config({ quiet: true });

  // Import dinámico: db/index.ts resuelve la URL de conexión al cargarse,
  // así que debe importarse después de fijar NODE_ENV=test.
  const { runMigrations } = await import('../db/migrate.js');
  const { pool } = await import('../db/index.js');

  try {
    await runMigrations();
  } finally {
    await pool.end();
  }
}
