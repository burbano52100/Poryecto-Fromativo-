-- =====================================================================
-- GASTROSENA - MIGRACION 017: RECORDATORIOS DE DEUDA (ADR 023)
-- =====================================================================
-- Historial de los recordatorios por correo a instructores con deuda.
-- Como máximo uno enviado por instructor cada 24 horas; los omitidos
-- también quedan con su motivo. Es idempotente y no borra datos.

DO $$ BEGIN
  CREATE TYPE estado_recordatorio AS ENUM ('enviado', 'fallido', 'omitido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS recordatorios_deuda (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  deuda_id       UUID REFERENCES deudas(id) ON DELETE SET NULL,
  canal          TEXT NOT NULL DEFAULT 'correo',
  estado         estado_recordatorio NOT NULL,
  modo_prueba    BOOLEAN NOT NULL DEFAULT FALSE,
  destinatario   TEXT,
  monto          NUMERIC(12,2),
  error          TEXT,
  enviado_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_hora     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_recordatorios_instructor ON recordatorios_deuda (instructor_id, fecha_hora DESC);
