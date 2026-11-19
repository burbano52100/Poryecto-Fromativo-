-- =====================================================================
-- GASTROSENA - APLICAR A MANO LAS MIGRACIONES 006 Y 007 (ADR 016)
-- =====================================================================
-- 006: elimina el perfil "invitado" (sus usuarios y datos, el valor del
--      enum rol_usuario y la columna menus_dia.precio_invitado).
-- 007: crea la tabla almuerzos_invitados con sus índices y su trigger.
--
-- La vía normal es el runner del backend (cd backend && npm run migrate:dev).
-- Este script es para aplicarlas con psql. No copia el SQL: incluye los
-- archivos canónicos de backend/src/db/migrations/ y los registra en
-- schema_migrations para que el runner no los vuelva a ejecutar.
-- Requiere las migraciones 001 a 005 ya aplicadas. Todo corre en una
-- transacción: si algo falla, la base queda como estaba. Ambas
-- migraciones son idempotentes, así que correrlo dos veces no daña nada.
--
-- Uso (desde la raíz del repositorio):
--   psql "postgresql://postgres:CLAVE@localhost:5432/gastrosena" -f database/migracion_almuerzos_invitados.sql
-- =====================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

\ir ../backend/src/db/migrations/006_eliminar_perfil_invitado.sql
INSERT INTO schema_migrations (version) VALUES ('006_eliminar_perfil_invitado.sql')
ON CONFLICT (version) DO NOTHING;

\ir ../backend/src/db/migrations/007_almuerzos_invitados.sql
INSERT INTO schema_migrations (version) VALUES ('007_almuerzos_invitados.sql')
ON CONFLICT (version) DO NOTHING;

COMMIT;
