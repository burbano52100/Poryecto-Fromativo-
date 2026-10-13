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
   - `docs/DECISIONES.md`, `docs/BASE_DE_DATOS.md`, `docs/API.md`, `docs/DESPLIEGUE.md`, `docs/PROBLEMAS.md`, `docs/PROGRESO.md`.
3. **Estructura de migraciones versionadas y scripts de base de datos**:
   - `backend/src/db/migrations/001_initial_schema.sql`.
   - `backend/scripts/bundle-migrations.ts`.
   - `backend/src/db/migrate.ts`.
   - `backend/src/db/bootstrapAdmin.ts`.
   - `backend/src/db/seed.ts`.
4. **Infraestructura y Configuración**:
   - Creado `docker-compose.yml` en la raíz con PostgreSQL 16 Alpine persistente en puerto 5432.
   - `backend/.env.example` y `backend/.env` actualizados.
   - Scripts en `backend/package.json` (`prebuild`, `build`, `migrate`, `seed`).
- **Commit**: `feat(db): migraciones versionadas postgresql, docker-compose, runner idempotente y bootstrap admin` (7a2424d)

---

## FASE 2: Backend (Express 5 + TypeScript)
- **Fecha**: 2026-10-12
- **Objetivo**: Modularizar en capas (`routes/`, `controllers/`, `middleware/`, `db/`), sustitución de arrays mock por consultas parametrizadas SQL, JWT seguro, eliminación de `x-user-role`, validación con Zod, helmet, rate-limit y pruebas.

### Tareas Realizadas:
1. **Middlewares de Seguridad y Manejo de Peticiones**:
   - `auth.middleware.ts`: Verificación criptográfica estricta de token JWT Bearer, expiración a 7 días y extracción segura de `req.user`.
   - `role.middleware.ts`: Autorización de roles (`requireRole`) leyendo exclusivamente el rol del JWT verificado. Eliminado por completo el uso del header no confiable `x-user-role`.
   - `error.middleware.ts`: Manejador centralizado de errores con captura de `ZodError` (400), códigos de error Postgres (`23505` duplicados -> 409, `23503` FKs -> 400, `23514` check constraints -> 400) y `AppError`.
   - `rateLimit.middleware.ts`: Limitador contra fuerza bruta en `/api/auth/login` (15 intentos por 15 min).
2. **Controladores y Rutas Modulares**:
   - **Auth** (`auth.controller.ts`, `auth.routes.ts`):
     - `login`: Búsqueda en base de datos, comparación con `bcryptjs`, emisión de JWT.
     - `register`: Validación Zod, prohibición estricta de auto-registrarse como `encargado` o `instructor`, hash bcrypt, creación de usuario en Postgres.
     - `facialLogin`: Simulación dev segura (retorna 403 en producción).
     - `getMe`: Consulta en base de datos con ficha asociada.
     - `getUsers`: Solo para encargado, sanitizado (sin `password_hash`).
   - **Menú del Día** (`menu.controller.ts`, `menu.routes.ts`):
     - `getActiveMenu`: Menú activo actual para aprendices e instructores.
     - `getAllMenus`: Historial completo para encargado.
     - `createMenu`: Publicación/creación de menú.
     - `updateMenuStatus`: Cambio de estado (`activo`, `borrador`, etc.).
   - **Ventas** (`ventas.controller.ts`, `ventas.routes.ts`):
     - `getVentasReport`: Reporte dinámico filtrado por periodos (`Día`, `Semana`, `Mes`, `Trimestre`, `Semestre`, `Año`) con desglose diario y listado de transacciones.
   - **Consumos** (`consumos.controller.ts`, `consumos.routes.ts`):
     - `getUserConsumos`: Historial de almuerzos del usuario autenticado (para aprendiz e instructor).
     - `reservarAlmuerzo`: Registro de consumo contra menú activo, actualización de stock vendido y deudas automáticas para instructor.
   - **Cartera / Deudas** (`deudas.controller.ts`, `deudas.routes.ts`):
     - `getDeudas`: Instructores con deudas pendientes, almuerzos pendientes y días vencidos calculados en consulta.
     - `getMiCuenta`: Saldo actual, acumulado mensual y consumo para el instructor.
     - `registrarPagoDeuda`: Registro de abonos/pagos y actualización de cartera.
   - **Inventario** (`inventario.controller.ts`, `inventario.routes.ts`):
     - `getMateriales` y `addMaterial`: Control de materias primas y stock.
     - `getRecetas`: Fórmulas de platos con ingredientes y costos.
     - `getKardex`: Historial de entradas, salidas y mermas.
     - `getMermas` y `addMerma`: Registro de desperdicios con actualización automática de stock en Kardex.
   - **Grupos y Fichas** (`grupos.controller.ts`, `grupos.routes.ts`):
     - `getGrupos`: Listado de fichas SENA con programa, aprendices, jornada y vocero.
     - `getMisFichasInstructor`: Fichas asignadas al instructor autenticado.
   - **Buzón de Sugerencias** (`sugerencias.controller.ts`, `sugerencias.routes.ts`):
     - `getSugerencias`: Lista de sugerencias (encargado ve todas; usuarios ven las suyas).
     - `createSugerencia`: Enviar sugerencia asociando automáticamente el autor del JWT.
     - `responderSugerencia`: Respuesta exclusiva del encargado.
   - **Instituciones & Visitas** (`instituciones.controller.ts`, `visitas.controller.ts`, `instituciones.routes.ts`, `visitas.routes.ts`):
     - `getInstituciones` y `createInstitucion`: Instituciones educativas y de visita.
     - `getVisitas`: Visitas registradas con institución real y cálculo dinámico de precio.
     - `getVisitasKPI`: Métricas del mes (total visitas, personas atendidas, ingresos).
     - `createVisita`: Validación Zod con restricción XOR de instructor.
   - **Perfil** (`perfil.controller.ts`, `perfil.routes.ts`):
     - `updatePerfil`: Actualización de nombre, correo y ficha del usuario autenticado.
   - **Health Check** (`health.routes.ts`):
     - `/api/health`: Ejecuta `SELECT 1` activo en PostgreSQL; reporta `connected` o 503 `disconnected`.
3. **Punto de Entrada y Servidor**:
   - `backend/src/app.ts`: Configurado con `app.set('trust proxy', 1)`, `helmet()`, CORS con lista de orígenes, parsers JSON y montaje de rutas.
   - `backend/src/index.ts`: Validación estricta de `JWT_SECRET` al arranque (cancela proceso si falta).
4. **Pruebas Automatizadas**:
   - `backend/src/tests/auth.test.ts`: Pruebas de middleware de autenticación (rechazo 401 sin token, rechazo 401 con token inválido, aceptación de JWT válido) y de autorización de roles (aprobación de roles coincidentes y rechazo 403 de roles no autorizados).

### Comandos Ejecutados y Resultados:
- `npm run test`: 5 pruebas ejecutadas exitosamente (5 pasadas, 0 fallidas, exit code 0).
- `npm run build`: Generación limpia de `prebuild` y `tsc -b` en `dist/` (exit code 0).

---

## FASE 3: Frontend (React 19 + Vite + TypeScript)
- **Estado**: Pendiente
- **Objetivo**: HashRouter, rutas protegidas por rol, code splitting lazy(), conexión con React Query en todas las pantallas y corrección de oxlint.

---

## FASE 4: Despliegue, CI/CD y Calidad
- **Estado**: Pendiente
- **Objetivo**: `render.yaml` configurado, GitHub Actions con `npm ci` y validación de PRs, limpieza de raíz, pruebas y README.
