# Pendientes de Backend para Integración con el Frontend

Este documento detalla los endpoints y ajustes que el equipo de backend debe habilitar o alinear para que el frontend pueda desconectar los mocks y operar al 100% contra la API real de GastroSENA.

---

## 🚨 1. Módulo de Beneficiarios (Paso 5) - URGENTE

| Endpoint Requerido | Método | Estado Actual en Backend | Qué falta en Backend |
|---|---|---|---|
| `/api/beneficiarios/estudiantes` | `GET` | ⚠️ Controlador listo (`beneficiarios.controller.ts`), **ruta no expuesta**. | Crear `backend/src/routes/beneficiarios.routes.ts` y montarlo con `app.use('/api/beneficiarios', router)` en `backend/src/app.ts`. Proteger con middleware `requireRole(['encargado'])`. |
| `/api/beneficiarios` | `GET` | ⚠️ Controlador listo, ruta no expuesta. | Montar la ruta en el router de beneficiarios. |
| `/api/beneficiarios/:usuarioId` | `PATCH` | ⚠️ Controlador listo (`toggleBeneficiario`), ruta no expuesta. | Montar la ruta en el router de beneficiarios con validación de body `{ es_beneficiario: boolean }`. |

> **Nota de Frontend:** El hook `frontend/src/hooks/useBeneficiarios.ts` ya tiene preparadas las llamadas a estos tres endpoints exactos. Actualmente opera con fallback local en `localStorage` hasta que el backend monte las rutas.

---

## 📦 2. Módulo de Inventario

| Endpoint Frontend Actual | Endpoint Real en Backend | Discrepancia a Corregir |
|---|---|---|
| `GET /api/inventario/stock` | `GET /api/inventario/materiales` | La ruta en el frontend está desfasada. El backend expone materiales, recetas, kardex y mermas bajo `/api/inventario/materiales`, `/api/inventario/recetas`, `/api/inventario/kardex`, `/api/inventario/mermas`. |
| `POST /api/inventario/stock` | `POST /api/inventario/materiales` | Ajustar URL y formato de payload. |

---

## 💳 3. Cartera de Deudas e Instructores

| Endpoint Requerido | Método | Estado en Backend | Detalle |
|---|---|---|---|
| `/api/deudas` | `GET` | ✅ Existe en backend | En backend requiere autenticación JWT con rol `instructor` (para ver sus deudas) o `encargado` (para ver cartera general). |
| `/api/deudas/:id/pagar` | `POST` | ✅ Existe en backend | Pendiente definir si al pagar una deuda de instructor se actualiza automáticamente el estado de las ventas vinculadas a `pagado`. |

---

## 👥 4. Grupos y Fichas SENA (Paso 4)

| Endpoint Requerido | Método | Estado en Backend | Detalle |
|---|---|---|---|
| `/api/grupos` | `GET` | ✅ Existe | Lista fichas/grupos. |
| `/api/grupos/:id/aprendices` | `GET` | ✅ Existe en controller | Retorna aprendices de una ficha con almuerzo reservado. |
| `/api/grupos/ventas/:ventaId/pago` | `PATCH` | ✅ Existe en controller | Permite marcar pagado/no pagado por aprendiz (bloquea modificación en reservas gratuitas de beneficiarios). |

---

## 📊 5. Reportes de Ventas y Consumos (Paso 2b)

- **Distinción de Beneficiarios:** El backend debe incluir la etiqueta o bandera `"Beneficiario"` y `precio_cobrado: 0` en el listado de transacciones de `GET /api/ventas`.
- **Separación de Métricas:** Separar en el resumen de ventas:
  1. *Almuerzos Servidos* (incluye pagos y subsidiados a $0).
  2. *Ingresos Efectivos* (suma solo `estado_pago = 'pagado'` y cobrados).
  3. *Cuentas por Cobrar* (`estado_pago = 'pendiente'`).
