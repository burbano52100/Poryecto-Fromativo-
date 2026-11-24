-- =====================================================================
-- GASTROSENA - MIGRACION 019: PRECIO DEL ALMUERZO PARA INSTRUCTORES (ADR 025)
-- =====================================================================
-- El aprendiz y el instructor pagan precios distintos por el mismo menú.
-- Cada menú guarda su precio para instructores. NULL significa "el mismo
-- precio del aprendiz": así quedan los menús anteriores, que se cobraron así.
-- Las ventas guardan su precio_cobrado, así que el histórico no cambia.
-- Es idempotente y no borra datos.

ALTER TABLE menus_dia ADD COLUMN IF NOT EXISTS precio_instructor NUMERIC(12,2);

DO $$ BEGIN
  ALTER TABLE menus_dia
    ADD CONSTRAINT chk_menus_precio_instructor CHECK (precio_instructor IS NULL OR precio_instructor >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
