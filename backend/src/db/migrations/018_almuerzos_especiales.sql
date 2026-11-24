-- =====================================================================
-- GASTROSENA - MIGRACION 018: ALMUERZOS ESPECIALES POR CONTRATO (ADR 024)
-- =====================================================================
-- Pedidos de dependencias del SENA (Bienestar al Aprendiz, la Regional,
-- Dirección General) con un menú distinto al del día y un precio propio,
-- casi siempre bajo un contrato. Flujo: programado -> entregado (descuenta
-- los ingredientes de su receta) -> pagado (entra a Ventas ese día).
-- Se puede cancelar mientras esté programado. Es idempotente y no borra datos.

DO $$ BEGIN
  CREATE TYPE estado_almuerzo_especial AS ENUM ('programado', 'entregado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS almuerzos_especiales (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante         TEXT NOT NULL CHECK (btrim(solicitante) <> '' AND char_length(solicitante) <= 150),  -- dependencia que lo pide
  responsable         TEXT NOT NULL CHECK (btrim(responsable) <> '' AND char_length(responsable) <= 150),  -- persona de contacto
  numero_contrato     TEXT CHECK (numero_contrato IS NULL OR char_length(numero_contrato) <= 60),
  fecha               DATE NOT NULL,                                                                    -- día de la entrega
  cantidad_personas   INTEGER NOT NULL CHECK (cantidad_personas > 0),
  menu_descripcion    TEXT NOT NULL CHECK (btrim(menu_descripcion) <> '' AND char_length(menu_descripcion) <= 500),
  receta_id           UUID REFERENCES recetas(id) ON DELETE SET NULL,                                   -- ingredientes que descuenta al entregarse
  precio_unitario     NUMERIC(12,2) NOT NULL CHECK (precio_unitario > 0),
  total               NUMERIC(12,2) GENERATED ALWAYS AS (cantidad_personas * precio_unitario) STORED,
  estado              estado_almuerzo_especial NOT NULL DEFAULT 'programado',
  pagado              BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_hora_entrega  TIMESTAMPTZ,
  entregado_por       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_hora_pago     TIMESTAMPTZ,                                                                      -- desde aquí cuenta en Ventas
  pago_registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  observaciones       TEXT CHECK (observaciones IS NULL OR char_length(observaciones) <= 500),
  creado_por          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Solo se paga lo entregado, y un pago siempre tiene su fecha
  CONSTRAINT chk_especial_pago CHECK (
    (pagado = FALSE AND fecha_hora_pago IS NULL)
    OR (pagado = TRUE AND fecha_hora_pago IS NOT NULL AND estado = 'entregado')
  )
);

CREATE INDEX IF NOT EXISTS idx_almuerzos_especiales_fecha ON almuerzos_especiales (fecha);
CREATE INDEX IF NOT EXISTS idx_almuerzos_especiales_estado ON almuerzos_especiales (estado, pagado);
CREATE INDEX IF NOT EXISTS idx_almuerzos_especiales_pago ON almuerzos_especiales (fecha_hora_pago) WHERE pagado;

DO $$ BEGIN
  CREATE TRIGGER trg_almuerzos_especiales_updated_at BEFORE UPDATE ON almuerzos_especiales
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
