-- =====================================================================
-- GASTROSENA - MIGRACION 002: BENEFICIARIOS, ESTADO DE PAGO Y RESERVAS
-- =====================================================================

-- 1. Agregar columna es_beneficiario en usuarios si no existe
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS es_beneficiario BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_usuarios_beneficiario
  ON usuarios(es_beneficiario)
  WHERE es_beneficiario = TRUE;

-- 2. Tipo ENUM estado_pago_venta
DO $$ BEGIN
  CREATE TYPE estado_pago_venta AS ENUM ('pendiente', 'pagado', 'gratis');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Columna estado_pago en ventas
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS estado_pago estado_pago_venta NOT NULL DEFAULT 'pendiente';

CREATE INDEX IF NOT EXISTS idx_ventas_estado_pago
  ON ventas(estado_pago);

-- 4. Indice unico para evitar reservas duplicadas por usuario en un mismo menu completado
CREATE UNIQUE INDEX IF NOT EXISTS unq_ventas_usuario_menu
  ON ventas (usuario_id, menu_id)
  WHERE estado = 'completada';

-- 5. Saneamiento retroactivo de datos existentes
UPDATE ventas
  SET estado_pago = 'pagado'
  WHERE metodo_pago IN ('saldo', 'efectivo') AND (estado_pago IS NULL OR estado_pago = 'pagado');

UPDATE ventas
  SET estado_pago = 'pendiente'
  WHERE metodo_pago = 'credito';

UPDATE ventas
  SET estado_pago = 'gratis'
  WHERE metodo_pago = 'cortesia' OR precio_cobrado = 0;

-- Saneamiento retroactivo de precios en menus del dia
UPDATE menus_dia
  SET precio_aprendiz = 5000
  WHERE precio_aprendiz = 3500;
