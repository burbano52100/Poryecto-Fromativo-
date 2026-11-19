-- =====================================================================
-- GASTROSENA - MIGRACION 009: AUDITORIA, CONFIGURACION Y ALERTAS (ADR 017)
-- =====================================================================
-- auditoria: registro de solo inserción de quién hizo qué y cuándo, con
--   los datos antes y después. Triggers impiden UPDATE y DELETE.
-- configuracion: parámetros que el encargado ajusta sin desplegar (cupo de
--   beneficiarios, margen y semanas de la sugerencia de preparación).
-- alertas: avisos para el encargado (stock insuficiente, menú sin receta,
--   beneficios que terminan, beneficiarios inactivos).
-- Es idempotente y no borra datos.

-- 1. Auditoría (sin FK a usuarios: el registro sobrevive aunque el usuario se borre)
CREATE TABLE IF NOT EXISTS auditoria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID,
  usuario_nombre  TEXT,
  rol             TEXT,
  accion          TEXT NOT NULL,
  entidad         TEXT NOT NULL,
  entidad_id      TEXT,
  datos_antes     JSONB,
  datos_despues   JSONB,
  fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria (fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria (usuario_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria (entidad, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria (accion, fecha_hora DESC);

CREATE OR REPLACE FUNCTION auditoria_solo_insercion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'La auditoría es de solo inserción: no se permite % sobre sus registros.', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_auditoria_sin_update BEFORE UPDATE ON auditoria
    FOR EACH ROW EXECUTE FUNCTION auditoria_solo_insercion();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_auditoria_sin_delete BEFORE DELETE ON auditoria
    FOR EACH ROW EXECUTE FUNCTION auditoria_solo_insercion();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Configuración
CREATE TABLE IF NOT EXISTS configuracion (
  clave            TEXT PRIMARY KEY,
  valor            JSONB NOT NULL,
  descripcion      TEXT,
  actualizado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('beneficiarios_cupo_maximo', '50', 'Cupo máximo de beneficiarios activos al mismo tiempo'),
  ('sugerencia_margen_pct', '10', 'Margen en % que se suma al promedio de almuerzos vendidos'),
  ('sugerencia_semanas', '4', 'Cuántos mismos días de la semana anteriores se promedian')
ON CONFLICT (clave) DO NOTHING;

-- 3. Alertas para el encargado
CREATE TABLE IF NOT EXISTS alertas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL,
  mensaje     TEXT NOT NULL,
  datos       JSONB,
  leida       BOOLEAN NOT NULL DEFAULT FALSE,
  leida_por   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  leida_en    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_alertas_pendientes ON alertas (leida, created_at DESC);
