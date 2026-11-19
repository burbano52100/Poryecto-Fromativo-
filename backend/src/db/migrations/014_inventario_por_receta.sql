-- =====================================================================
-- GASTROSENA - MIGRACION 014: DESCUENTO DE INVENTARIO POR RECETA (ADR 020)
-- =====================================================================
-- Cada menú del día puede tener una receta. Cada almuerzo vendido descuenta
-- sus ingredientes del stock con un movimiento de salida en el kardex que
-- apunta a la venta o al registro de invitados (referencia_tipo/referencia_id).
-- Es idempotente y no borra datos.

ALTER TABLE menus_dia ADD COLUMN IF NOT EXISTS receta_id UUID REFERENCES recetas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kardex_referencia ON movimientos_kardex (referencia_tipo, referencia_id);
