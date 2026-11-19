-- =====================================================================
-- GASTROSENA - MIGRACION 011: ESTADO DE LAS CUENTAS Y CARGAS MASIVAS (ADR 018)
-- =====================================================================
-- usuarios.estado (pendiente, activo, inactivo, rechazado) reemplaza al
-- booleano activo como fuente de verdad. activo se conserva como columna
-- generada (estado = 'activo') para no romper las consultas existentes.
-- Las cuentas existentes quedan en el estado equivalente (activo/inactivo).
-- Las solicitudes de instructor pendientes de la migración 005 pasan a
-- usuarios como cuentas pendientes; la tabla solicitudes_cuenta se
-- conserva como historial. Es idempotente y no borra datos.

-- 1. Tipos
DO $$ BEGIN
  CREATE TYPE estado_cuenta AS ENUM ('pendiente', 'activo', 'inactivo', 'rechazado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE origen_cuenta AS ENUM ('registro', 'carga_masiva');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Estado desde el booleano activo, que pasa a ser una columna generada
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado estado_cuenta;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'usuarios'
      AND column_name = 'activo' AND is_generated = 'NEVER'
  ) THEN
    UPDATE usuarios
    SET estado = (CASE WHEN activo THEN 'activo' ELSE 'inactivo' END)::estado_cuenta
    WHERE estado IS NULL;
    ALTER TABLE usuarios DROP COLUMN activo;
    ALTER TABLE usuarios ADD COLUMN activo BOOLEAN GENERATED ALWAYS AS (estado = 'activo') STORED;
  END IF;
END $$;

UPDATE usuarios SET estado = 'activo' WHERE estado IS NULL;
ALTER TABLE usuarios ALTER COLUMN estado SET DEFAULT 'activo';
ALTER TABLE usuarios ALTER COLUMN estado SET NOT NULL;

-- 3. Datos de aprobación y de la contraseña inicial
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_clave BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS origen origen_cuenta NOT NULL DEFAULT 'registro';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aprobado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono TEXT;

CREATE INDEX IF NOT EXISTS idx_usuarios_estado_rol ON usuarios (estado, rol);

-- 4. Solicitudes de instructor pendientes → cuentas pendientes
INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, estado, origen)
SELECT s.nombre, s.cedula, s.email, s.password_hash, 'instructor', 'pendiente', 'registro'
FROM solicitudes_cuenta s
WHERE s.estado = 'pendiente' AND s.rol = 'instructor'
  AND NOT EXISTS (
    SELECT 1 FROM usuarios u WHERE u.cedula = s.cedula OR lower(u.email) = lower(s.email)
  );

-- 5. Fichas: estado para saber cuándo una ficha terminó su formación
ALTER TABLE fichas ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activa';
DO $$ BEGIN
  ALTER TABLE fichas ADD CONSTRAINT chk_fichas_estado CHECK (estado IN ('activa', 'finalizada'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Historial de cargas masivas
DO $$ BEGIN
  CREATE TYPE tipo_carga_masiva AS ENUM ('instructores', 'aprendices');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cargas_masivas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            tipo_carga_masiva NOT NULL,
  archivo         TEXT NOT NULL,
  total_filas     INTEGER NOT NULL CHECK (total_filas >= 0),
  creados         INTEGER NOT NULL CHECK (creados >= 0),
  omitidos        INTEGER NOT NULL CHECK (omitidos >= 0),
  con_error       INTEGER NOT NULL CHECK (con_error >= 0),
  coordinador_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detalle         JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cargas_masivas_fecha ON cargas_masivas (fecha_hora DESC);
