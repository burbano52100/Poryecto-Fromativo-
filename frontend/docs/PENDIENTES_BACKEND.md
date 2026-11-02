# Pendientes de Backend para Integración con el Frontend

**Estado al 2 de noviembre de 2026: no hay pendientes.** Todo lo que este documento pedía quedó implementado en la Fase 5 y el frontend ya no usa datos simulados.

| Tema | Resuelto con |
|---|---|
| Beneficiarios | `GET /api/beneficiarios/estudiantes`, `GET /api/beneficiarios`, `PATCH /api/beneficiarios/:usuarioId` montados en `app.ts` (solo Encargado). |
| Inventario | El frontend usa las rutas reales `/api/inventario/materiales`, `/recetas`, `/kardex` y `/mermas`. |
| Cartera de deudas | `POST /api/deudas/:id/pagar` marca como pagadas las ventas más antiguas que el pago alcanza a cubrir. |
| Grupos | `GET /api/grupos` trae conteos reales; `GET /api/grupos/:id/aprendices` y `PATCH /api/grupos/ventas/:ventaId/pago` conectados. |
| Reporte de ventas | `GET /api/ventas` separa servidos, gratis, cobrados y por cobrar, con períodos en curso y etiqueta de beneficiario. |

El contrato completo está en [`docs/API.md`](../../docs/API.md). Si aparece un endpoint nuevo pendiente, se registra aquí.
