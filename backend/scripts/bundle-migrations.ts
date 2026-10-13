import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.resolve(__dirname, '../src/db/migrations');
const outputFile = path.resolve(__dirname, '../src/db/migrationsMap.ts');

if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const migrations = files.map((file) => {
  const fullPath = path.join(migrationsDir, file);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return {
    version: file,
    sql: content,
  };
});

const fileContent = `// Archivo generado automáticamente por scripts/bundle-migrations.ts
// NO EDITAR MANUALMENTE. Fuente: src/db/migrations/*.sql

export interface MigrationItem {
  version: string;
  sql: string;
}

export const migrations: MigrationItem[] = ${JSON.stringify(migrations, null, 2)};
`;

fs.writeFileSync(outputFile, fileContent, 'utf-8');
console.log(`[bundle-migrations] Empaquetadas ${migrations.length} migraciones en ${outputFile}`);
