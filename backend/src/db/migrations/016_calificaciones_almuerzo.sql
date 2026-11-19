-- =====================================================================
-- GASTROSENA - MIGRACION 016: CALIFICACION DEL ALMUERZO (ADR 022)
-- =====================================================================
-- Aprendices e instructores califican el almuerzo que reservaron, una vez
-- por menú (pueden editarla hasta el final de ese día). El encargado ve
-- las calificaciones sin el nombre de quien califica. Idempotente.

CREATE TABLE IF NOT EXISTS calificaciones_almuerzo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id     UUID NOT NULL REFERENCES menus_dia(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estrellas   SMALLINT NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario  TEXT CHECK (comentario IS NULL OR char_length(comentario) <= 300),
  fecha_hora  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_calificacion_menu_usuario UNIQUE (menu_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_calificaciones_fecha ON calificaciones_almuerzo (fecha_hora);

DO $$ BEGIN
  CREATE TRIGGER trg_calificaciones_updated_at BEFORE UPDATE ON calificaciones_almuerzo
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
