# Registro de Incidencias y Problemas Resueltos — GastroSENA

Este documento recopila problemas detectados durante el desarrollo, cómo se diagnosticaron y solucionaron, y las consideraciones pendientes.

---

## 1. Problemas Resueltos

### 1.1 Inconsistencia de motores de base de datos
- **Síntoma**: Existían scripts de MySQL con SQLAlchemy (`database.py`, `models.py`) en `database/` mientras el backend usaba arrays en memoria y había un archivo SQL de PostgreSQL (`gastrosena_schema.sql`).
- **Causa**: Prototipo previo exploratorio sin unificación de motor.
- **Solución**: Se eliminaron los archivos de MySQL/SQLAlchemy y se formalizó PostgreSQL 14+ como único motor relacional.

### 1.2 Dependencia del header no confiable `x-user-role`
- **Síntoma**: Cualquier cliente podía suplantar roles enviando `x-user-role: encargado`.
- **Causa**: Header temporal de desarrollo sin validación criptográfica de sesión.
- **Solución**: Autenticación estricta con JWT firmado. El middleware `requireRole` extrae el rol exclusivamente del payload del token decodificado tras validar la firma con `JWT_SECRET`. Se eliminó `x-user-role` del backend y del interceptor de axios en el frontend.

### 1.3 Error 404 al recargar páginas en GitHub Pages
- **Síntoma**: Al navegar en la aplicación y recargar la página en una ruta como `/encargado/inicio`, GitHub Pages arrojaba error 404.
- **Causa**: `App.tsx` manipulaba `window.history.pushState` directamente ignorando el base path `/Poryecto-Fromativo-/`. Al ser GitHub Pages un servidor estático, no resuelve rutas SPA sin un fallback físico.
- **Solución**: Migración a `HashRouter` (`#/login`, `#/encargado/inicio`), garantizando que la navegación y las recargas funcionen sin requerir configuración especial del servidor web.

### 1.4 Falla de migraciones en múltiples arranques de Render
- **Síntoma**: Si `npm run migrate` corre en cada arranque, sentencias como `CREATE TYPE` o `CREATE TABLE` fallarían en el segundo inicio por colisión de nombres.
- **Causa**: Postgres no soporta `IF NOT EXISTS` para enums estándar y la ausencia de tabla de control de versiones.
- **Solución**: Creación de tabla `schema_migrations`, división en archivos versionados (`001_initial_schema.sql`), ejecución transaccional por versión y bloques `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object ...` para máxima seguridad.

### 1.5 Rate Limiter bloqueando usuarios detrás de Render
- **Síntoma**: Todos los clientes compartían la misma IP del proxy inverso de Render, agotando el límite de peticiones del rate limiter.
- **Solución**: Se configuró `app.set('trust proxy', 1)` en Express para que el rate limiter inspeccione el encabezado `X-Forwarded-For`.

---

## 2. Pendientes y Monitoreo Abierto
- **Límite de 30 días en Render Postgres gratuito**: Monitorear el periodo de gracia y considerar migrar la cadena `DATABASE_URL` a Neon o Supabase antes del vencimiento.
