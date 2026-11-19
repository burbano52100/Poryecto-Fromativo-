-- =====================================================================
-- GASTROSENA - MIGRACION 006: ELIMINACION DEL PERFIL INVITADO (ADR 016)
-- =====================================================================
-- Ya nadie se registra ni inicia sesión como invitado. Los almuerzos de
-- personas externas los registra el encargado en "Almuerzos Invitados"
-- (migración 007). Esta migración borra solo lo que pertenece al perfil:
-- sus usuarios y sus datos, el valor del enum y la tarifa del menú.
-- Es idempotente: compara rol::text para poder correr aunque el enum ya
-- no tenga el valor 'invitado'.

-- 1. Las reservas de invitados liberan su porción del menú antes de borrarse
UPDATE menus_dia m
SET cantidad_vendida = GREATEST(m.cantidad_vendida - r.porciones, 0)
FROM (
  SELECT v.menu_id, COUNT(*)::int AS porciones
  FROM ventas v
  JOIN usuarios u ON u.id = v.usuario_id
  WHERE u.rol::text = 'invitado' AND v.estado = 'completada'
  GROUP BY v.menu_id
) r
WHERE r.menu_id = m.id;

-- 2. Sugerencias de invitados. Su FK es ON DELETE SET NULL: sin este paso
--    quedarían en el buzón como sugerencias anónimas.
DELETE FROM sugerencias
WHERE usuario_id IN (SELECT id FROM usuarios WHERE rol::text = 'invitado');

-- 3. Usuarios invitados. Sus ventas, movimientos de saldo, deudas (con sus
--    pagos) y registros de reconocimiento facial caen por ON DELETE CASCADE.
DELETE FROM usuarios WHERE rol::text = 'invitado';

-- 4. Quitar 'invitado' del enum rol_usuario. PostgreSQL no borra valores de
--    un enum: se crea el tipo sin ese valor y se cambian las dos columnas que
--    lo usan (usuarios.rol y solicitudes_cuenta.rol).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'rol_usuario'::regtype AND enumlabel = 'invitado'
  ) THEN
    -- El CHECK de solicitudes_cuenta compara contra el tipo viejo: se recrea al final
    ALTER TABLE solicitudes_cuenta DROP CONSTRAINT IF EXISTS solicitudes_cuenta_rol_check;

    ALTER TYPE rol_usuario RENAME TO rol_usuario_anterior;
    CREATE TYPE rol_usuario AS ENUM ('aprendiz', 'instructor', 'encargado');

    ALTER TABLE usuarios
      ALTER COLUMN rol TYPE rol_usuario USING rol::text::rol_usuario;
    ALTER TABLE solicitudes_cuenta
      ALTER COLUMN rol TYPE rol_usuario USING rol::text::rol_usuario;

    ALTER TABLE solicitudes_cuenta
      ADD CONSTRAINT solicitudes_cuenta_rol_check CHECK (rol IN ('instructor', 'encargado'));

    DROP TYPE rol_usuario_anterior;
  END IF;
END $$;

-- 5. Tarifa de invitado del menú del día
ALTER TABLE menus_dia DROP COLUMN IF EXISTS precio_invitado;
