-- =====================================================================
-- GASTROSENA - MIGRACION 008: VISITAS CON INSTITUCION Y RESPONSABLE EN TEXTO
-- =====================================================================
-- El encargado escribe a mano la institución y el responsable de una
-- visita; ya no los elige de una lista. Se agregan dos columnas de texto
-- y se copian los nombres de las visitas que ya existen, así no se pierde
-- nada. Las columnas viejas (institucion_id, instructor_id,
-- nombre_instructor_ext) se conservan como historial, pero dejan de ser
-- obligatorias y la aplicación ya no las usa.
-- Es idempotente.

-- 1. Columnas de texto
ALTER TABLE visitas_institucionales ADD COLUMN IF NOT EXISTS institucion_nombre TEXT;
ALTER TABLE visitas_institucionales ADD COLUMN IF NOT EXISTS responsable_nombre TEXT;

-- 2. Copiar los nombres de las visitas existentes. Del responsable se quita
--    el sufijo "(Instructor SENA)" que traía el nombre del instructor demo.
UPDATE visitas_institucionales v
SET institucion_nombre = COALESCE(
      NULLIF(LEFT(BTRIM((SELECT i.nombre FROM instituciones i WHERE i.id = v.institucion_id)), 150), ''),
      'Sin registrar')
WHERE v.institucion_nombre IS NULL;

UPDATE visitas_institucionales v
SET responsable_nombre = COALESCE(
      NULLIF(LEFT(BTRIM(REGEXP_REPLACE(
        COALESCE((SELECT u.nombre FROM usuarios u WHERE u.id = v.instructor_id), v.nombre_instructor_ext, ''),
        '\s*\(Instructor SENA\)\s*$', '', 'i')), 150), ''),
      'Sin registrar')
WHERE v.responsable_nombre IS NULL;

-- 3. Obligatorias, sin texto vacío y de máximo 150 caracteres
ALTER TABLE visitas_institucionales ALTER COLUMN institucion_nombre SET NOT NULL;
ALTER TABLE visitas_institucionales ALTER COLUMN responsable_nombre SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE visitas_institucionales
    ADD CONSTRAINT chk_visita_institucion_nombre
    CHECK (BTRIM(institucion_nombre) <> '' AND CHAR_LENGTH(institucion_nombre) <= 150);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visitas_institucionales
    ADD CONSTRAINT chk_visita_responsable_nombre
    CHECK (BTRIM(responsable_nombre) <> '' AND CHAR_LENGTH(responsable_nombre) <= 150);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Las visitas nuevas no llevan institución ni instructor de las listas
ALTER TABLE visitas_institucionales ALTER COLUMN institucion_id DROP NOT NULL;
ALTER TABLE visitas_institucionales DROP CONSTRAINT IF EXISTS chk_instructor_presente;

-- 5. Borrar una institución ya no borra sus visitas (antes era ON DELETE CASCADE):
--    la visita guarda su propio nombre
ALTER TABLE visitas_institucionales DROP CONSTRAINT IF EXISTS visitas_institucionales_institucion_id_fkey;
ALTER TABLE visitas_institucionales
  ADD CONSTRAINT visitas_institucionales_institucion_id_fkey
  FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE SET NULL;
