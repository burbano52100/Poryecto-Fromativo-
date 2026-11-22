# Pendientes para completar GastroSENA

Estado al **22 de noviembre de 2026**, en `main` (commit `7707bd9`, Fase 7 con HeroUI v3). Lo ya hecho está en [PROGRESO.md](PROGRESO.md) y las decisiones en [DECISIONES.md](DECISIONES.md).

## Resultado de la última verificación (20 de noviembre)

| Prueba | Resultado |
|---|---|
| Backend: `npm run lint`, `npm run build`, `npm test` | ✅ 247/247 tests contra PostgreSQL real |
| Frontend: `npm run lint`, `npm run build`, `npm test` | ✅ 79/79 tests |
| `npm audit` (backend y frontend) | ✅ 0 vulnerabilidades |
| Base local `gastrosena` | ✅ Migraciones 001 a 017 aplicadas |
| Recorrido en navegador de los paneles | ⚠️ El último fue el 4 de noviembre, antes de HeroUI v3 y del panel del Coordinador |

### Resuelto desde el 4 de noviembre
- `integracion/pendientes` ya está en `main` (las dos ramas apuntan al mismo commit).
- La migración 005 y las siguientes ya están aplicadas en la base local. En Render se aplican solas al arrancar.
- **Visitas institucionales**: se pueden marcar como realizadas (migración 012, `PATCH /api/visitas/:id/realizada`).
- **Aprobación de cuentas**: ya no la hace cualquier encargado. El rol **Coordinador** aprueba aprendices e instructores, administra usuarios y fichas y hace cargas masivas desde Excel/CSV (ADR 018). El registro solo ofrece aprendiz e instructor.
- **Compra de invitado**: se reemplazó por Almuerzos Invitados, que registra el encargado (ADR 016).
- **Inventario**: cada almuerzo vendido descuenta los ingredientes de su receta (ADR 020), con alertas de stock insuficiente y de menú sin receta.
- Módulos nuevos:
  - Auditoría.
  - Configuración editable: cupo de beneficiarios y sugerencia de preparación.
  - Beneficios con cupo y lista de espera (ADR 019).
  - Cierre de caja diario (ADR 021).
  - Calificación del almuerzo (ADR 022).
  - Recordatorios de deuda por correo (ADR 023).
  - Reportes en PDF y Excel.
- Toda la interfaz pasó a HeroUI v3, con skeletons y toasts.

---

## 1. Antes de desplegar (requiere código)
- [x] **Coordinador en producción**: `bootstrapAdmin.ts` ahora también crea el primer coordinador con `COORDINADOR_DOCUMENT`, `COORDINADOR_PASSWORD`, `COORDINADOR_NAME` y `COORDINADOR_EMAIL`, igual que el primer encargado con `ADMIN_*`. Antes solo lo creaba la semilla, y sin él nadie podía aprobar cuentas de aprendiz ni de instructor. Cubierto por `bootstrapAdmin.integration.test.ts`.
- [ ] **Un solo encargado.** El registro ya no ofrece la cuenta de encargado y el bootstrap solo crea uno si no existe ninguno. Decidir si hace falta una forma de agregar más.

## 2. Despliegue (configuración manual, requiere acceso a las cuentas)
- [ ] En Render: crear el Blueprint desde `render.yaml` y cargar `ADMIN_DOCUMENT`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `COORDINADOR_DOCUMENT`, `COORDINADOR_PASSWORD` y `COORDINADOR_EMAIL`. El coordinador necesita un documento y un correo distintos de los del encargado.
- [ ] En GitHub → Settings → Variables: crear `VITE_API_URL` con la URL del backend en Render terminada en `/api`.
- [ ] **Correo**: `correo.service.ts` lee `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM`, pero no están en `backend/.env.example` ni en `render.yaml`. Sin `SMTP_HOST`, los recordatorios de deuda solo se imprimen en la consola ("modo prueba"). Agregarlas a los dos archivos y cargarlas en Render.
- [ ] Recordar que la base gratuita de Render expira a los 30 días (ver `DESPLIEGUE.md`).

## 3. Documentación atrasada
- [ ] `DECISIONES.md` llega hasta el ADR 016. Las migraciones 009 a 017 y el código citan los ADR 017 a 023, que no están escritos:
  - 017: auditoría, configuración y alertas.
  - 018: coordinador.
  - 019: beneficios.
  - 020: inventario por receta.
  - 021: cierre de caja.
  - 022: calificaciones.
  - 023: recordatorios de deuda.
- [ ] `API.md` no documenta `/api/coordinador`, `/api/auditoria`, `/api/configuracion`, `/api/alertas`, `/api/cierres-caja`, `/api/calificaciones` ni `/api/reportes`.
- [ ] `BASE_DE_DATOS.md` llega hasta la migración 008. Faltan la 009 a la 017.
- [ ] `PROGRESO.md` cierra la Fase 7 con 172/69 tests. Falta registrar lo que vino después: coordinador, migraciones 008 a 017 y HeroUI v3.

## 4. Verificación pendiente
- [x] **`seed.integration.test.ts` fallaba los domingos.** El historial de la semilla va de lunes a sábado, y la prueba "deja historia suficiente para la sugerencia" pedía la sugerencia de hoy, que un domingo no tiene historia. Ahora un domingo pide la del lunes. Se comprobó simulando los 7 días de la semana.
- [ ] Recorrido en navegador, en escritorio y celular, de los paneles con HeroUI v3, incluido el del Coordinador: solicitudes, usuarios, fichas y carga masiva.
- [ ] La base local `gastrosena` tenía datos de una semilla anterior: deudas que no cuadraban con las ventas y porciones infladas. No se volvió a revisar. Dejarla limpia exige vaciarla y volver a sembrarla (`npm run db:init` y `npm run db:seed`), lo cual **borra los datos actuales**.

## 5. Mejoras funcionales
- [ ] **Visitas institucionales**: ya se marcan como realizadas, pero no hay forma de cancelarlas ni de marcarlas como pagadas.
- [ ] **Reconocimiento facial real** (Teachable Machine) con verificación de vida (mirar arriba, girar, parpadear). La tabla `reconocimiento_facial` ya existe en la base de datos.
- [ ] **Marca de entrega del almuerzo**: hoy "Consumido" se deduce de la fecha del menú (ADR 010).
- [ ] **Cierre de menús**: los menús de días pasados quedan en `activo`. Solo pasa a `completado` el menú activo que se reemplaza en el mismo día.
- [ ] **Tarifas de Almuerzos Invitados editables desde la app (opcional)**: hoy están en `backend/src/config/almuerzosInvitados.ts` (ADR 016). La tabla `configuracion` de la migración 009 ya existe, así que bastaría agregar las claves y su pantalla.
- [ ] **Inventario**:
  - `materiales.stock_actual` y `stock_minimo` siguen en `NUMERIC(12,2)`, mientras el kardex usa `NUMERIC(12,3)`. Llevarlos a 3 decimales.
  - Costo promedio ponderado en las entradas.
  - Aviso de stock por debajo del mínimo y de materiales vencidos. Hoy solo hay alerta cuando el descuento de una receta no alcanza.
- [ ] **Recargas de saldo** (`movimientos_saldo`, `usuarios.saldo`) y **compras a proveedores** (`compras`, `compra_detalle`): las tablas existen pero la aplicación no tiene esos flujos.

## 6. Limpieza del repositorio
- [ ] El `package.json` y el `package-lock.json` de la raíz son restos de una estructura anterior. Revisar que nadie los use y eliminarlos.
- [ ] La carpeta externa `PROYECTO SENA/` tiene su propio `.git` residual; el proyecto real es `Poryecto-Fromativo-/`.
- [ ] Borrar las ramas remotas cuyo contenido ya está en `main`:
  - `BURBANO`, `KevinDEV`, `julianDEV` y `julianDEV-wip`.
  - `chore/quitar-facial-login`, `fix/cerrar-sesion`, `fix/campos-solo-numeros` y `feat/grupos-por-reservas`.
  - `integracion/pendientes`.

  `burbanoDEV` ya se borró.
- [ ] Quitar `fichas.vocero` y `fichas.cantidad_estudiantes` del esquema. Hoy solo los escriben la semilla y `cuentas.service.ts` al crear una ficha nueva. Es una migración que borra columnas.
