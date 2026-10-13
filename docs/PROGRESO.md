# Bitácora de Progreso — GastroSENA

Registro cronológico de tareas, fases, comandos ejecutados y resultados obtenidos.

---

## FASE 1: Base de Datos (PostgreSQL)
- **Fecha**: 2026-10-12
- **Objetivo**: Unificar PostgreSQL como único motor relacional, estructurar migraciones versionadas con control de estados, docker-compose para desarrollo local, runner idempotente, bootstrap de encargado y seed demo condicional.

### Tareas Realizadas:
1. **Eliminación de prototipo obsoleto**:
   - Eliminados: `database/database.py`, `database/models.py`, `database/create_tables.py`.
   - Actualizado: `database/README.md` aclarando que PostgreSQL es el único motor y que las migraciones residen en `backend/src/db/migrations/`.
2. **Creación de la carpeta de documentación `docs/`**:
   - `docs/DECISIONES.md`: Registro de decisiones de arquitectura (PostgreSQL único, migraciones versionadas, bootstrap de administrador, HashRouter, JWT en localStorage, eliminación de x-user-role).
   - `docs/BASE_DE_DATOS.md`: Diccionario de datos, relaciones, enums y flujo para agregar migraciones incrementales (`002_...sql`).
   - `docs/API.md`: Catálogo completo de endpoints REST con roles, payloads y códigos de respuesta.
   - `docs/DESPLIEGUE.md`: Guía de despliegue en Render y GitHub Pages, variables de entorno (con `VITE_API_URL` como Variable en Actions) y bootstrap del encargado.
   - `docs/PROBLEMAS.md`: Registro de incidencias resueltas (motores inconsistentes, rate limiting en Render, 404s en GitHub Pages, idempotencia de enums).
   - `docs/PROGRESO.md`: Bitácora activa por fases.
3. **Estructura de migraciones versionadas**:
   - Creado `backend/src/db/migrations/001_initial_schema.sql` con esquema completo (extensión pgcrypto, enums defensivos, tablas de usuarios, fichas, menús, ventas, deudas, inventario, recetas, mermas, instituciones y visitas).
   - Creado `backend/scripts/bundle-migrations.ts`: empaqueta automáticamente los archivos SQL en `src/db/migrationsMap.ts` antes del build.
   - Creado `backend/src/db/migrate.ts`: runner transaccional con tabla `schema_migrations` ejecutable en Node nativo en producción.
   - Creado `backend/src/db/bootstrapAdmin.ts`: crea el primer usuario encargado si no existe ninguno a partir de `ADMIN_DOCUMENT` y `ADMIN_PASSWORD`.
   - Creado `backend/src/db/seed.ts`: siembra usuarios demo (`aprendiz 1005678901`, `instructor 1098765432`, `encargado 1012345678` con hash `demo123`), fichas, menús, inventario y sugerencias, bloqueado en producción salvo `SEED_DEMO=true`.
4. **Infraestructura y Configuración**:
   - Creado `docker-compose.yml` en la raíz con PostgreSQL 16 Alpine persistente en puerto 5432.
   - Actualizado `backend/.env.example` con `DATABASE_URL`, `DATABASE_URL_TEST`, `JWT_SECRET`, y variables de bootstrap `ADMIN_*`.
   - Actualizado `backend/package.json` con scripts `"prebuild"`, `"build"`, `"migrate"`, `"migrate:dev"`, `"seed"`, `"seed:dev"`, `"start"`.
   - Actualizado `backend/tsconfig.json` con `rootDir: "src"`, `outDir: "./dist"` y exclusión de tests.
   - Limpieza de carpeta anidada duplicada `Poryecto-Fromativo-/` y adición de `*.tsbuildinfo` a `.gitignore`.

### Comandos Ejecutados y Resultados:
- `Remove-Item database/database.py, database/models.py, database/create_tables.py -Force`: Exit code 0.
- `npm install pg bcryptjs jsonwebtoken zod helmet express-rate-limit; npm install -D @types/pg @types/bcryptjs @types/jsonwebtoken`: Instaladas 33 dependencias, exit code 0.
- `npx tsx scripts/bundle-migrations.ts`: Generado `backend/src/db/migrationsMap.ts` con 1 migración empaquetada, exit code 0.
- `npm run build`: Ejecutado `prebuild` y `tsc -b` generando exitosamente `dist/db/migrate.js`, `dist/db/migrationsMap.js`, `dist/db/bootstrapAdmin.js`, `dist/db/seed.js`, `dist/index.js`, exit code 0.

---

## FASE 2: Backend (Express 5 + TypeScript)
- **Estado**: Pendiente
- **Objetivo**: Modularizar en capas (`routes/`, `controllers/`, `middleware/`, `db/`), sustitución de arrays mock por consultas parametrizadas SQL, JWT seguro, eliminación de `x-user-role`, validación con Zod, helmet, rate-limit y pruebas.

---

## FASE 3: Frontend (React 19 + Vite + TypeScript)
- **Estado**: Pendiente
- **Objetivo**: HashRouter, rutas protegidas por rol, code splitting lazy(), conexión con React Query en todas las pantallas y corrección de oxlint.

---

## FASE 4: Despliegue, CI/CD y Calidad
- **Estado**: Pendiente
- **Objetivo**: `render.yaml` configurado, GitHub Actions con `npm ci` y validación de PRs, limpieza de raíz, pruebas y README.
