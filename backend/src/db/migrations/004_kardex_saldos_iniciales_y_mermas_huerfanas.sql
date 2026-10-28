-- =====================================================================
-- GASTROSENA - MIGRACION 004: KARDEX COHERENTE CON EL STOCK (SOLO DATOS)
-- =====================================================================

-- Antes de esta migración había materiales sin ningún movimiento en el kardex
-- y mermas registradas sin su movimiento (movimiento_kardex_id NULL).
-- Esta migración no cambia stock_actual: reconstruye el kardex para que el
-- último saldo_resultante de cada material coincida con su stock_actual.
-- Es idempotente: solo actúa sobre materiales sin movimientos y mermas sin
-- movimiento_kardex_id.

-- 1. Saldo inicial para cada material sin movimientos.
--    La cantidad incluye las mermas huérfanas, que se descuentan en el paso 2.
--    La fecha es anterior a la primera merma huérfana para que el orden cuadre.
INSERT INTO movimientos_kardex (material_id, fecha_hora, tipo, concepto, cantidad_entrada, saldo_resultante, referencia_tipo)
SELECT m.id,
       LEAST(m.created_at, COALESCE(h.primera_merma - INTERVAL '1 millisecond', m.created_at)),
       'entrada',
       'Saldo inicial (migración 004)',
       m.stock_actual + COALESCE(h.total_perdido, 0),
       m.stock_actual + COALESCE(h.total_perdido, 0),
       'migracion_004'
FROM materiales m
LEFT JOIN (
  SELECT material_id, SUM(cantidad_perdida) AS total_perdido, MIN(fecha_hora) AS primera_merma
  FROM mermas
  WHERE movimiento_kardex_id IS NULL
  GROUP BY material_id
) h ON h.material_id = m.id
WHERE NOT EXISTS (SELECT 1 FROM movimientos_kardex k WHERE k.material_id = m.id);

-- 2. Movimiento de kardex para cada merma huérfana, enlazado a la merma.
--    El saldo parte del último movimiento anterior a la merma y descuenta
--    las mermas huérfanas acumuladas desde ese movimiento.
WITH huerfanas AS (
  SELECT mer.id, mer.material_id, mer.cantidad_perdida, mer.razon, mer.registrado_por, mer.fecha_hora,
         base.saldo_resultante AS saldo_base, base.id AS base_id
  FROM mermas mer
  CROSS JOIN LATERAL (
    SELECT k.id, k.saldo_resultante
    FROM movimientos_kardex k
    WHERE k.material_id = mer.material_id AND k.fecha_hora <= mer.fecha_hora
    ORDER BY k.fecha_hora DESC, k.created_at DESC
    LIMIT 1
  ) base
  WHERE mer.movimiento_kardex_id IS NULL
),
calculadas AS (
  SELECT h.*,
         h.saldo_base - SUM(h.cantidad_perdida) OVER (
           PARTITION BY h.material_id, h.base_id ORDER BY h.fecha_hora, h.id
         ) AS saldo
  FROM huerfanas h
),
insertados AS (
  INSERT INTO movimientos_kardex (material_id, fecha_hora, usuario_id, tipo, concepto, cantidad_salida, saldo_resultante, referencia_tipo, referencia_id)
  SELECT material_id, fecha_hora, registrado_por, 'merma', 'Merma: ' || razon, cantidad_perdida, saldo, 'merma', id
  FROM calculadas
  RETURNING id, referencia_id
)
UPDATE mermas mer
SET movimiento_kardex_id = i.id
FROM insertados i
WHERE mer.id = i.referencia_id;
