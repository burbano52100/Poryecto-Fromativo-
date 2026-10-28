import { getClient, pool } from './index.js';
import { migrations } from './migrationsMap.js';
import { bootstrapAdmin } from './bootstrapAdmin.js';

export async function runMigrations(): Promise<void> {
  const client = await getClient();
  console.log('[Migrate] Iniciando verificación y ejecución de migraciones en PostgreSQL...');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedResult = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC;'
    );
    const appliedVersions = new Set(appliedResult.rows.map((r) => r.version));

    let executedCount = 0;

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      console.log(`[Migrate] Ejecutando migración: ${migration.version}...`);
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1);',
          [migration.version]
        );
        await client.query('COMMIT');
        executedCount++;
        console.log(`[Migrate] ✓ Migración ${migration.version} aplicada con éxito.`);
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(`[Migrate] ✗ Error al ejecutar la migración ${migration.version}:`, migrationError);
        throw migrationError;
      }
    }

    if (executedCount === 0) {
      console.log('[Migrate] La base de datos ya está al día. No hay migraciones pendientes.');
    } else {
      console.log(`[Migrate] Total migraciones aplicadas en esta ejecución: ${executedCount}.`);
    }

    // Bootstrap del primer administrador si está configurado en variables de entorno
    await bootstrapAdmin();
  } finally {
    client.release();
  }
}

// Ejecutar directamente si se llama como script
const isMainModule = process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js');
if (isMainModule) {
  runMigrations()
    .then(() => {
      console.log('[Migrate] Proceso de migración finalizado exitosamente.');
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[Migrate] Error crítico en migraciones:', err);
      try {
        await pool.end();
      } catch {}
      process.exit(1);
    });
}
