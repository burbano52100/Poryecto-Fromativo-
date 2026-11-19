-- =====================================================================
-- GASTROSENA - MIGRACION 013: BENEFICIOS DE ALMUERZO CON CUPO Y LISTA DE ESPERA (ADR 019)
-- =====================================================================
-- Cada alta de un beneficiario es un registro en beneficios con fechas,
-- prioridad, estado (activo, en_espera, finalizado) y motivo de fin.
-- usuarios.es_beneficiario se mantiene (lo usan la reserva a $0 y el menú)
-- y un trigger lo sincroniza: es true solo si el aprendiz tiene un
-- beneficio activo. Los beneficiarios actuales pasan a beneficios activos.
-- Es idempotente y no borra datos.

DO $$ BEGIN
  CREATE TYPE estado_beneficio AS ENUM ('activo', 'en_espera', 'finalizado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE motivo_fin_beneficio AS ENUM (
    'fecha_cumplida', 'retiro', 'inasistencias', 'mal_uso', 'informacion_falsa',
    'cuenta_desactivada', 'ficha_finalizada', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS beneficios (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id              UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado                  estado_beneficio NOT NULL,
  fecha_inicio            DATE NOT NULL,
  fecha_fin               DATE,
  prioridad               INTEGER NOT NULL DEFAULT 1 CHECK (prioridad >= 1), -- 1 = la más alta
  sin_apoyo_incompatible  BOOLEAN NOT NULL CHECK (sin_apoyo_incompatible),
  motivo_fin              motivo_fin_beneficio,
  detalle_fin             TEXT,
  fecha_finalizacion      TIMESTAMPTZ,
  creado_por              UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  finalizado_por          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_beneficio_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
  CONSTRAINT chk_beneficio_motivo CHECK ((estado = 'finalizado') = (motivo_fin IS NOT NULL))
);

-- Un solo beneficio vigente (activo o en espera) por aprendiz
CREATE UNIQUE INDEX IF NOT EXISTS unq_beneficio_vigente ON beneficios (usuario_id) WHERE estado <> 'finalizado';
CREATE INDEX IF NOT EXISTS idx_beneficios_espera ON beneficios (estado, prioridad, created_at);
CREATE INDEX IF NOT EXISTS idx_beneficios_fin ON beneficios (fecha_fin) WHERE estado = 'activo';

DO $$ BEGIN
  CREATE TRIGGER trg_beneficios_updated_at BEFORE UPDATE ON beneficios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- usuarios.es_beneficiario = tiene un beneficio activo
CREATE OR REPLACE FUNCTION sincronizar_es_beneficiario()
RETURNS TRIGGER AS $$
DECLARE
  afectado UUID := COALESCE(NEW.usuario_id, OLD.usuario_id);
BEGIN
  UPDATE usuarios u
  SET es_beneficiario = EXISTS (
    SELECT 1 FROM beneficios b WHERE b.usuario_id = afectado AND b.estado = 'activo'
  )
  WHERE u.id = afectado;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_beneficios_sincronizar AFTER INSERT OR UPDATE OR DELETE ON beneficios
    FOR EACH ROW EXECUTE FUNCTION sincronizar_es_beneficiario();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Beneficiarios actuales → beneficios activos desde hoy
INSERT INTO beneficios (usuario_id, estado, fecha_inicio, prioridad, sin_apoyo_incompatible)
SELECT u.id, 'activo', (NOW() AT TIME ZONE 'America/Bogota')::date, 1, TRUE
FROM usuarios u
WHERE u.rol = 'aprendiz' AND u.es_beneficiario = TRUE
  AND NOT EXISTS (SELECT 1 FROM beneficios b WHERE b.usuario_id = u.id AND b.estado <> 'finalizado');
