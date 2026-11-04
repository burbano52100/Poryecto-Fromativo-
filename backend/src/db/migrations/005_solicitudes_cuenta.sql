-- =====================================================================
-- GASTROSENA - MIGRACION 005: SOLICITUDES DE CUENTA (ADR 015)
-- =====================================================================
-- Instructores y encargados no se auto-registran: piden la cuenta y un
-- encargado la aprueba o la rechaza. La solicitud vive en su propia tabla,
-- así que una cuenta pendiente nunca aparece en usuarios (listas de
-- instructores, fichas, cartera ni reportes). Al aprobarla se crea el
-- usuario con la contraseña que ya venía cifrada en la solicitud.

-- 1. Estados de la solicitud
DO $$ BEGIN
  CREATE TYPE estado_solicitud AS ENUM ('pendiente', 'aprobada', 'rechazada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabla de solicitudes
CREATE TABLE IF NOT EXISTS solicitudes_cuenta (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT NOT NULL,
  cedula         TEXT NOT NULL,
  email          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,                       -- bcrypt, igual que usuarios.password_hash
  rol            rol_usuario NOT NULL CHECK (rol IN ('instructor', 'encargado')),
  estado         estado_solicitud NOT NULL DEFAULT 'pendiente',
  motivo_rechazo TEXT,
  revisado_por   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  revisado_en    TIMESTAMPTZ,
  usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,  -- usuario creado al aprobar
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Una sola solicitud pendiente por documento y por correo
CREATE UNIQUE INDEX IF NOT EXISTS unq_solicitudes_pendiente_cedula
  ON solicitudes_cuenta (cedula)
  WHERE estado = 'pendiente';

CREATE UNIQUE INDEX IF NOT EXISTS unq_solicitudes_pendiente_email
  ON solicitudes_cuenta (lower(email))
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado
  ON solicitudes_cuenta (estado, created_at DESC);
