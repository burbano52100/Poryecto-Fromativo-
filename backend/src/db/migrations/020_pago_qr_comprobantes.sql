-- =====================================================================
-- SARA - MIGRACION 020: PAGO CON EL CÓDIGO QR Y COMPROBANTES (ADR 027)
-- =====================================================================
-- El aprendiz y el instructor pagan su almuerzo con el código QR de
-- Bancolombia del Centro de Gestión y suben la captura del comprobante.
-- Un lector OCR saca banco, valor, fecha, hora y número del comprobante.
--
-- * ventas.metodo_pago acepta 'qr'.
-- * ventas.vence_en: hasta cuándo se aparta la porción mientras llega el
--   comprobante. NULL = no vence (pagada, en revisión o de otro método).
-- * comprobantes_pago guarda cada intento, también los rechazados, con lo
--   que leyó el OCR. La imagen solo se guarda mientras está en revisión.
-- * Un comprobante no se puede usar dos veces, aunque lo suban desde otra
--   cuenta: la huella de la imagen y el par banco + número son únicos entre
--   los comprobantes aceptados o en revisión.
-- Es idempotente y no borra datos.

-- ADD VALUE puede ir dentro de la transacción de la migración (PostgreSQL 12+)
-- mientras el valor nuevo no se use en ella.
ALTER TYPE metodo_pago ADD VALUE IF NOT EXISTS 'qr';

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS vence_en TIMESTAMPTZ;

DO $$ BEGIN
  CREATE TYPE estado_comprobante AS ENUM ('aceptado', 'rechazado', 'en_revision');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS comprobantes_pago (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id            UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  usuario_id          UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  huella              TEXT NOT NULL,
  banco               TEXT,
  numero_comprobante  TEXT,
  valor               NUMERIC(12,2),
  fecha_pago          DATE,
  hora_pago           TEXT,
  destinatario_ok     BOOLEAN NOT NULL DEFAULT false,
  confianza           NUMERIC(5,2),
  texto_leido         TEXT,
  estado              estado_comprobante NOT NULL,
  motivo              TEXT,
  imagen              BYTEA,
  imagen_tipo         TEXT,
  revisado_por        UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  revisado_en         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unq_comprobantes_huella
  ON comprobantes_pago (huella)
  WHERE estado <> 'rechazado';

CREATE UNIQUE INDEX IF NOT EXISTS unq_comprobantes_banco_numero
  ON comprobantes_pago (banco, numero_comprobante)
  WHERE estado <> 'rechazado' AND banco IS NOT NULL AND numero_comprobante IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comprobantes_venta ON comprobantes_pago (venta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON comprobantes_pago (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_qr_vencen ON ventas (vence_en) WHERE vence_en IS NOT NULL;
