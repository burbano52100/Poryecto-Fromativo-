# Registro de Decisiones de Arquitectura (ADR) — GastroSENA

Este documento recopila las decisiones técnicas clave tomadas durante el desarrollo de GastroSENA, la justificación de cada una y las alternativas evaluadas y descartadas.

---

## ADR 001: Unificación de Motor en PostgreSQL
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: El repositorio contenía scripts de MySQL/SQLAlchemy (`database.py`, `models.py`) y un esquema detallado en PostgreSQL (`gastrosena_schema.sql`). Mantener dos motores generaba inconsistencias y fricción en despliegues.
- **Decisión**: Unificar exclusivamente en **PostgreSQL 14+**.
- **Consecuencias**: Se eliminaron los prototipos de SQLAlchemy/MySQL. Todo el backend interactúa mediante consultas parametrizadas con `pg`.
- **Alternativas descartadas**:
  - *MySQL*: Menor compatibilidad con Supabase/Render y types avanzados.
  - *SQLite*: No apto para despliegue en contenedores efímeros sin persistencia compartida.

---

## ADR 002: Sistema de Migraciones Versionadas y Runner Idempotente
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: En Render (plan gratuito) no existen hooks de pre-despliegue. Si la migración se ejecuta en cada inicio del servicio (`node dist/db/migrate.js && node dist/index.js`), debe ser estrictamente idempotente. `CREATE TYPE` en Postgres falla si el enum ya existe. Además, un solo archivo monolithic impediría evolucionar la base de datos sin romper instancias ya migradas.
- **Decisión**:
  1. Dividir las migraciones en archivos SQL numerados en `backend/src/db/migrations/` (`001_initial_schema.sql`, etc.).
  2. Implementar una tabla de control `schema_migrations (version text primary key, applied_at timestamptz default now())`.
  3. Ejecutar las migraciones pendientes dentro de una transacción.
  4. Generar automáticamente un bundle TypeScript (`migrationsMap.ts`) en el prebuild para que viaje compilado a `dist/` sin utilidades de copia externas.
- **Alternativas descartadas**:
  - *ORM pesado (Prisma/TypeORM)*: Demasiada sobrecarga y dependencias binarias para el monorepo.
  - *Un solo archivo `schema.sql`*: No permitía aplicar cambios incrementales en producción.

---

## ADR 003: Bootstrap Seguro del Primer Administrador en Producción
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: El seed con usuarios demo (`demo123`) es un riesgo de seguridad en servidores públicos. A su vez, el endpoint de auto-registro `/api/auth/register` prohíbe explícitamente registrar roles `encargado` o `instructor`. Por tanto, una base de datos desplegada en Render iniciaría sin administradores.
- **Decisión**: Implementar `bootstrapAdmin` al finalizar las migraciones. Si la tabla `usuarios` no contiene ningún usuario con rol `encargado`, y existen las variables de entorno `ADMIN_DOCUMENT` y `ADMIN_PASSWORD`, se inserta automáticamente el primer encargado con contraseña cifrada en bcrypt.
- **Alternativas descartadas**:
  - *Habilitar rol encargado en el formulario de registro*: Vulnerabilidad crítica que permite a cualquier usuario ganar privilegios.
  - *Correr el seed demo en producción*: Expone contraseñas conocidas (`demo123`) públicamente.

---

## ADR 004: HashRouter para Despliegue en GitHub Pages
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: GitHub Pages sirve sitios estáticos. Con `BrowserRouter` y la subruta base `/Poryecto-Fromativo-/`, al recargar una ruta como `/encargado/inicio` el servidor de GitHub responde 404 porque no existe un archivo HTML físico en esa subruta, requiriendo un truco con `404.html`.
- **Decisión**: Adoptar `HashRouter` (`#/login`, `#/aprendiz/inicio`, etc.).
- **Consecuencias**: Las recargas en cualquier página funcionan de forma transparente en GitHub Pages y en local, sin configuraciones complejas de rewrite.
- **Alternativas descartadas**:
  - *BrowserRouter con script de redirección 404.html*: Frágil, añade destellos de carga y problemas de sincronización de estado.
  - *Navegación manual con `window.history.pushState`*: No actualizaba correctamente la UI ni permitía botones de retroceso/avance del navegador.

---

## ADR 005: Almacenamiento de JWT en LocalStorage para Monorepo Cross-Domain
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: El frontend se aloja en `burbano52100.github.io` y el backend en `gastrosena-backend.onrender.com`. Al ser dominios distintos, las cookies `HttpOnly` requieren configuración de `SameSite=None; Secure`, políticas estrictas de CORS y enfrentan bloqueo por políticas de privacidad de navegadores modernos contra cookies de terceros.
- **Decisión**: Conservar el token JWT en `localStorage` y enviarlo mediante el encabezado `Authorization: Bearer <token>`.
- **Consecuencias**: Adecuado y estándar para este proyecto formativo distribuido entre GitHub Pages y Render.
- **Alternativas descartadas**:
  - *Cookies HttpOnly SameSite=None*: Bloqueadas frecuentemente por navegadores al estar frontend y backend en dominios distintos de nivel superior.

---

## ADR 006: Eliminación del Header de Confianza `x-user-role`
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: El prototipo anterior confiaba en el header `x-user-role` enviado desde el cliente, permitiendo a cualquier aprendiz enviar `x-user-role: encargado` y acceder a funciones restringidas.
- **Decisión**: El middleware `requireRole` lee el rol **exclusivamente** desde el payload del JWT firmado y verificado con `JWT_SECRET`. Se eliminó el header `x-user-role` tanto en el cliente como en el servidor.
