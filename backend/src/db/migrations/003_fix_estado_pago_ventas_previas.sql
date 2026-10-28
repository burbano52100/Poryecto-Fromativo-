-- =====================================================================
-- GASTROSENA - MIGRACION 003: CORRECCION DE estado_pago EN VENTAS PREVIAS
-- =====================================================================

-- Corrige el saneamiento del paso 5 de la migración 002, cuyo WHERE nunca coincidía.
-- Solo afecta ventas creadas ANTES de aplicar la 002. Después de esa fecha,
-- estado_pago lo fija el backend (una reserva de aprendiz es 'saldo' + 'pendiente'
-- hasta que el Encargado la marca pagada) y no debe sobrescribirse.
WITH corte AS (
  SELECT applied_at FROM schema_migrations
  WHERE version = '002_add_beneficiarios_and_estado_pago.sql'
)
UPDATE ventas v
SET estado_pago = CASE
    WHEN v.metodo_pago = 'cortesia' OR v.precio_cobrado = 0 THEN 'gratis'::estado_pago_venta
    WHEN v.metodo_pago = 'credito'                         THEN 'pendiente'::estado_pago_venta
    WHEN v.metodo_pago IN ('saldo', 'efectivo')            THEN 'pagado'::estado_pago_venta
  END
FROM corte
WHERE v.created_at < corte.applied_at;
