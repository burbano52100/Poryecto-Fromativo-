# Pendientes para completar GastroSENA

Estado al **28 de octubre de 2026**, rama `julianDEV-wip`. Este documento lista lo que falta para terminar el proyecto completo; lo ya hecho está en [PROGRESO.md](PROGRESO.md).

## Resumen

| Área | Estado |
|---|---|
| Base de datos (PostgreSQL, migraciones 001–004) | ✅ Lista |
| Autenticación, roles por JWT, CORS, rate limit | ✅ Lista |
| Menú del día, reservas, ventas (backend + frontend) | ✅ Conectado; ventas necesita ajustes (paso 2b) |
| Inventario: stock, kardex, recetas, mermas (backend) | ✅ Listo con tests |
| Inventario, Cartera, Grupos, Buzón (frontend) | ❌ Siguen con datos mock |
| Beneficiarios | ⚠️ Backend a medias, sin frontend |
| Integración entre roles (Paso 3) | ❌ Pendiente |
| Rutas con HashRouter, CI, despliegue | ❌ Pendiente |

Tests del backend: 55 pasando (`npm test` en `backend/`). El frontend no tiene tests todavía.

---

## Paso 2 — Endpoints y conexión del frontend

### 2b. Reporte de ventas (`GET /api/ventas`)
- [ ] Separar los totales: almuerzos servidos (incluye los gratis), ingresos cobrados (`estado_pago='pagado'`) y por cobrar (`estado_pago='pendiente'`). Hoy suma todo `precio_cobrado` como ingreso, incluidas reservas sin pagar.
- [ ] Usar períodos en días calendario de America/Bogota (Día = hoy). Hoy "Día" son las últimas 24 horas.
- [ ] Quitar el `LIMIT 7` del gráfico: agrupar por día y, en Semestre y Año, por mes.
- [ ] Filtrar las transacciones por el período elegido y mostrar el estado de pago (Pagado/Pendiente/Gratis) en lugar de `metodo_pago`.
- [ ] Responder 400 a un período desconocido.
- [ ] Tests de cada período, incluidas las ventas gratis de beneficiarios.

**Decisiones abiertas:**
- ¿Los períodos son "en curso" (esta semana desde el lunes, este mes desde el 1°) o los últimos N días?
- Pagar una deuda de instructor (`POST /deudas/:id/pagar`) no marca sus ventas como pagadas. Hay que decidir si el pago las marca automáticamente o si "por cobrar" se muestra separado por aprendices e instructores.

### 2c. Conectar el frontend que sigue con mock
- [ ] **Inventario** (5 sub-vistas: Stock, Recetas, Kardex, Mermas, Configuración) con los endpoints de `/api/inventario`.
- [ ] **Cartera de Deudas** con `/api/deudas`.
- [ ] **Grupos**: por ahora solo listar las tarjetas con `/api/grupos`.
- [ ] **Buzón de Sugerencias** de los 4 roles con `/api/sugerencias`.
- [ ] Ajustar los hooks `useCartera`, `useGrupos`, `useInventario` y `useSugerencias`: sus URLs y tipos no coinciden con el backend (por ejemplo, `/inventario/stock` no existe; es `/inventario/materiales`).
- [ ] Usar React Query con invalidación tras cada mutación, y estados de carga y error con `LoadingSpinner`.
- [ ] Eliminar los datos mock de esas secciones.

---

## Paso 3 — Integración entre roles
- [ ] Una reserva de aprendiz debe verse del lado del Encargado en Ventas y Consumos, y descontar el cupo del menú. El descuento de cupo ya funciona; falta verificarlo de punta a punta en la interfaz.
- [ ] Una sugerencia de cualquier rol debe aparecer en el Buzón de gestión del Encargado, y al marcarla como atendida deben actualizarse Total, Atendidas y Pendientes.
- [ ] `StatsHeader` del Encargado (Ventas de Hoy, Ingresos de Hoy, Deudas Pendientes, Sugerencias Pendientes) con datos reales. Hoy no llama a la API.

---

## Paso 4 — Grupos: aprendices y control de pago
- [ ] Al hacer clic en la tarjeta de un grupo, desplegar los aprendices que reservaron almuerzo. El backend ya existe: `GET /api/grupos/:id/aprendices`.
- [ ] Botones Pagado / No pagado por aprendiz. El backend ya existe: `PATCH /api/grupos/ventas/:ventaId/pago`; bloquea las reservas gratis.
- [ ] Los instructores no aparecen aquí; siguen en Cartera de Deudas.
- [ ] El aprendiz debe ver en Mis Fichas/Consumos si su almuerzo sigue reservado y si está pagado.
- [ ] Decidir el `metodo_pago` de las reservas sin pagar: hoy se guardan como `saldo`, lo que confunde. Ninguna consulta decide nada con ese campo; solo se muestra.

---

## Paso 5 — Beneficiarios

**Backend (a medias):**
- [x] Columna `usuarios.es_beneficiario` (migración 002).
- [x] Al reservar, el backend cobra $0 si el aprendiz es beneficiario y $5.000 si no; nunca usa el precio del cliente. Tiene test.
- [x] Controlador `beneficiarios.controller.ts` (listar estudiantes, listar beneficiarios, asignar/quitar).
- [ ] **Falta crear `beneficiarios.routes.ts` y montarlo en `app.ts`**: hoy esos endpoints no se pueden llamar.
- [ ] Búsqueda y filtro por ficha o nombre en la lista de estudiantes.
- [ ] Etiqueta "Beneficiario" en los reportes de Ventas y Consumos.
- [ ] Tests de los endpoints de beneficiarios (solo rol Encargado).

**Frontend (no existe):**
- [ ] Ítem "Beneficiarios" en el sidebar del Encargado (acento ámbar) con dos vistas: "Todos los estudiantes registrados" (botón Agregar) y "Beneficiarios actuales" (botón Quitar con confirmación).
- [ ] En el panel del Aprendiz beneficiario: almuerzo en $0, badge "Beneficiario" y reserva con un clic.
- [ ] Si el Encargado quita a alguien, el precio vuelve a $5.000 desde la siguiente reserva; las reservas ya hechas no cambian.

---

## Paso 6 — Decisiones ya aprobadas por implementar o verificar
- [x] CORS con lista exacta (`http://localhost:5173`, `https://burbano52100.github.io` y `FRONTEND_URL`).
- [x] Rate limit en `/register`: 10 por hora por IP, desactivado con `NODE_ENV=test`.
- [x] Tests con PostgreSQL real vía `DATABASE_URL_TEST`: aplican migraciones, limpian tablas y se niegan a correr contra `DATABASE_URL`.
- [ ] **Rutas con HashRouter y lazy loading**: `App.tsx` maneja las rutas a mano con `pushState`, muestra una barra de debug "Rutas:" y no usa `ProtectedRoute` (aunque ya existe y `react-router-dom` está instalado).
- [ ] Rutas por rol: `/aprendiz/inicio`, `/instructor/inicio`, `/encargado/inicio`, `/invitado/inicio`.
- [ ] Vitest en el frontend (hoy no hay tests de frontend).
- [ ] Confirmar que no quede ningún uso de `x-user-role` en el frontend.
- [ ] **CI**: crear `.github/workflows/ci.yml` con `services: postgres` que corra build, lint y tests de backend y frontend. Hoy solo existe `deploy.yml`.
- [ ] **render.yaml**: agregar `DATABASE_URL` con `fromDatabase` (`name` + `property: connectionString`) dentro de `envVars`.
- [ ] Sin Docker: actualizar la documentación que todavía lo menciona (`docker-compose.yml`, `backend/.env.example`, `database/README.md`, `docs/PROGRESO.md`) para indicar PostgreSQL local.

---

## Paso 7 — Cierre
- [ ] Probar el flujo completo con los 4 roles: un aprendiz normal reserva a $5.000, un beneficiario reserva a $0, el Encargado lo ve en Ventas y en Grupos, marca pagado y el aprendiz lo ve reflejado.
- [ ] Integrar `julianDEV-wip` a `main` (vía pull request) y desplegar.
- [ ] Build, lint y tests en verde en backend y frontend.

---

## Otros pendientes técnicos
- [ ] **Decimales del stock**: `materiales.stock_actual` y `stock_minimo` son `NUMERIC(12,2)` y el kardex usa 3 decimales. Por ahora los movimientos de stock aceptan 2 decimales. Si se necesitan 3, hace falta una migración que cambie esas columnas a `NUMERIC(12,3)`.
- [ ] **Configuración de Inventario**: el texto "Notificar cuando el stock esté por debajo del 20%" es ambiguo (no existe un stock máximo en la BD) y esas notificaciones no están implementadas. Las reglas actuales usan el stock mínimo: Bajo ≤ mínimo, Crítico ≤ 50 % del mínimo, Venciendo ≤ 5 días.
- [ ] **Costo en entradas**: una entrada con costo nuevo reemplaza el costo del material; no calcula promedio ponderado. Definir si se quiere promedio.
- [ ] **Bundle del frontend**: el JS principal pesa 580 kB; el lazy loading del Paso 6 debería reducirlo.
- [ ] El script `build` del backend corre `prebuild` dos veces (npm ya lo ejecuta solo).
- [ ] El repo de afuera (`PROYECTO SENA/`) es un residuo con su propio `.git`; el proyecto real es `Poryecto-Fromativo-/`. Conviene limpiarlo para que nadie haga commits ahí por error.
