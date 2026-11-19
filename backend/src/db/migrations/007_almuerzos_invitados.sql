-- =====================================================================
-- GASTROSENA - MIGRACION 007: ALMUERZOS INVITADOS (ADR 016)
-- =====================================================================
-- El encargado registra los almuerzos que vende a invitados, en tres tipos
-- con tarifa fija: instructores, aprendices y corrientes. Cada fila es un
-- registro de venta y `cantidad` es el número de personas.
-- El precio unitario se copia en la fila al registrar, así que el histórico
-- no cambia si después cambian las tarifas (las tarifas vigentes están en
-- backend/src/config/almuerzosInvitados.ts).

DO $$ BEGIN
  CREATE TYPE tipo_almuerzo_invitado AS ENUM ('instructor', 'aprendiz', 'corriente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS almuerzos_invitados (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo             tipo_almuerzo_invitado NOT NULL,
  cantidad         INTEGER NOT NULL CHECK (cantidad > 0),               -- número de personas
  precio_unitario  NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  total            NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  nombre_invitado  TEXT,
  registrado_por   UUID NOT NULL REFERENCES usuarios(id),               -- encargado que lo registró
  fecha_hora       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_almuerzos_invitados_fecha
  ON almuerzos_invitados (fecha_hora);

CREATE INDEX IF NOT EXISTS idx_almuerzos_invitados_tipo_fecha
  ON almuerzos_invitados (tipo, fecha_hora);

CREATE INDEX IF NOT EXISTS idx_almuerzos_invitados_registrado_por
  ON almuerzos_invitados (registrado_por);

DO $$ BEGIN
  CREATE TRIGGER trg_almuerzos_invitados_updated_at BEFORE UPDATE ON almuerzos_invitados
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
