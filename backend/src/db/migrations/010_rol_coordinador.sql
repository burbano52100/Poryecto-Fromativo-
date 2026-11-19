-- =====================================================================
-- GASTROSENA - MIGRACION 010: ROL COORDINADOR (ADR 018)
-- =====================================================================
-- El coordinador administra las cuentas de instructores y aprendices
-- (aprobación, carga masiva y gestión). Va en su propia migración porque
-- PostgreSQL no deja usar un valor nuevo de un enum en la misma
-- transacción que lo agrega.

ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'coordinador';
