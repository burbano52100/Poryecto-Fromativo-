-- =====================================================================
-- GASTROSENA - MIGRACION 012: VISITAS REALIZADAS
-- =====================================================================
-- El encargado marca una visita como realizada (programada → realizada).
-- El valor 'realizada' ya existe en estado_visita desde la migración 001;
-- se asegura por si la base viene de otra versión. Se guarda cuándo se
-- marcó y quién la confirmó. precio_unitario y total_a_cobrar ya quedan
-- guardados en cada visita desde la 001. Es idempotente y no borra datos.

ALTER TYPE estado_visita ADD VALUE IF NOT EXISTS 'realizada';

ALTER TABLE visitas_institucionales ADD COLUMN IF NOT EXISTS fecha_hora_realizada TIMESTAMPTZ;
ALTER TABLE visitas_institucionales
  ADD COLUMN IF NOT EXISTS confirmada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;
