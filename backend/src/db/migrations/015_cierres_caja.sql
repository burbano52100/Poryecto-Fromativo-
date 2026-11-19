-- =====================================================================
-- GASTROSENA - MIGRACION 015: CIERRE DE CAJA DIARIO (ADR 021)
-- =====================================================================
-- Un cierre por fecha (hora de Colombia). Mientras el día esté cerrado no
-- se pueden crear, editar ni eliminar reservas, registros de invitados ni
-- pagos de esa fecha. Reabrir exige motivo. Es idempotente y no borra datos.

DO $$ BEGIN
  CREATE TYPE estado_cierre AS ENUM ('cerrado', 'reabierto');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cierres_caja (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha                           DATE NOT NULL UNIQUE,
  almuerzos_aprendices            INTEGER NOT NULL DEFAULT 0,
  almuerzos_beneficiarios         INTEGER NOT NULL DEFAULT 0,
  almuerzos_instructores          INTEGER NOT NULL DEFAULT 0,
  almuerzos_invitados_instructores INTEGER NOT NULL DEFAULT 0,
  almuerzos_invitados_aprendices  INTEGER NOT NULL DEFAULT 0,
  almuerzos_invitados_corrientes  INTEGER NOT NULL DEFAULT 0,
  ingresos_esperados              NUMERIC(12,2) NOT NULL DEFAULT 0,
  ingresos_recibidos              NUMERIC(12,2) NOT NULL CHECK (ingresos_recibidos >= 0),
  diferencia                      NUMERIC(12,2) GENERATED ALWAYS AS (ingresos_recibidos - ingresos_esperados) STORED,
  detalle                         JSONB NOT NULL DEFAULT '{}'::jsonb,
  observaciones                   TEXT,
  estado                          estado_cierre NOT NULL DEFAULT 'cerrado',
  cerrado_por                     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_hora_cierre               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reabierto_por                   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_hora_reapertura           TIMESTAMPTZ,
  motivo_reapertura               TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_estado ON cierres_caja (estado, fecha);

DO $$ BEGIN
  CREATE TRIGGER trg_cierres_caja_updated_at BEFORE UPDATE ON cierres_caja
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
