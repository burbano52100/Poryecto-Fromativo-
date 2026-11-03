# Pendientes para completar GastroSENA

Estado al **3 de noviembre de 2026**, en la rama `integracion/pendientes`. Lo ya hecho está en [PROGRESO.md](PROGRESO.md) y las decisiones en [DECISIONES.md](DECISIONES.md).

## Resultado de la prueba completa (3 de noviembre)

| Prueba | Resultado |
|---|---|
| Backend: `npm run lint`, `npm run build`, `npm test` | ✅ 115/115 tests contra PostgreSQL real |
| Frontend: `npm run lint`, `npm run build`, `npm test` | ✅ 44/44 tests |
| Recorrido en Chrome de los 4 paneles (23 secciones), escritorio y celular | ✅ Sin errores de API ni de JavaScript y sin desborde horizontal |
| CI de `main` y deploy a GitHub Pages | ✅ Último run exitoso |
| `npm audit` | ⚠️ 2 vulnerabilidades en el backend y 3 en el frontend (ver Prioridad alta) |
| Base de datos local | ✅ Migraciones 001–004 aplicadas; los descuadres vienen de la semilla de demostración (ver abajo) |

Error encontrado y corregido en esta rama: los contadores "Cartera de Deudas" (3) y "Buzón de Sugerencias" (2) del Sidebar del Encargado eran valores fijos. Ahora salen de `GET /api/dashboard/encargado`.

---

## 1. Para integrar ya
- [ ] Fusionar `integracion/pendientes` en `main`. Incluye las ramas `chore/quitar-facial-login` (PR #1), `fix/cerrar-sesion`, `fix/campos-solo-numeros` y `feat/grupos-por-reservas`. Al fusionarla con *merge commit*, GitHub marca también el PR #1 como fusionado.

## 2. Decisión pendiente del equipo
- [ ] **Registro de instructores y encargados con aprobación.** Ya hay un plan: tabla `solicitudes_cuenta`, endpoints `/api/solicitudes-cuenta` y una sección para el Encargado. Falta definir:
  1. Quién aprueba las solicitudes de encargado: cualquier encargado o solo el Encargado General.
  2. Si basta con la aprobación o si el encargado también puede crear cuentas directamente.

## 3. Prioridad alta (seguridad y producción)
- [ ] **Vulnerabilidades de dependencias.** Todas tienen arreglo compatible con `npm audit fix`:
  - Backend: `body-parser` (alta, DoS) y `qs` (moderada, DoS).
  - Frontend: `vite` (alta, solo afecta al servidor de desarrollo), `zod` (alta, consumo de memoria) y `follow-redirects` (alta, a través de axios).
- [ ] **El rate limit del login cuenta también los ingresos exitosos.** Hay 15 intentos por IP cada 15 minutos y el mensaje dice "intentos fallidos". En el SENA muchos aprendices comparten la IP pública del wifi y podrían recibir 429. Solución propuesta: `skipSuccessfulRequests: true` en `loginLimiter`.
- [ ] **El JWT no vuelve a consultar el usuario.** `authenticateToken` confía en el token durante 7 días, así que una cuenta desactivada sigue entrando hasta que el token vence. Opciones: tokens más cortos o verificar `usuarios.activo` en cada petición.

## 4. Despliegue (configuración manual, no es código)
- [ ] En Render: crear el Blueprint desde `render.yaml` y cargar `ADMIN_DOCUMENT`, `ADMIN_PASSWORD` y `ADMIN_EMAIL`.
- [ ] En GitHub → Settings → Variables: crear `VITE_API_URL` con la URL del backend en Render terminada en `/api`.
- [ ] Recordar que la base gratuita de Render expira a los 30 días (ver `DESPLIEGUE.md`).

## 5. Semilla de demostración (`backend/src/db/seed.ts`, solo desarrollo)
- [ ] Las deudas demo no coinciden con las ventas: la instructora María tiene $25.000 en ventas pendientes y su deuda dice $15.000, y Diana tiene una deuda de $10.000 sin ventas. La app sí mantiene la deuda al día al reservar; el problema es solo de la semilla.
- [ ] Los menús se crean con 40–45 porciones "vendidas" que no existen, y por eso el cupo mostrado es menor que el real.
- [ ] La fecha de "hoy" se calcula en UTC (`toISOString()`): después de las 7 p.m. crea el menú del día siguiente.

## 6. Mejoras funcionales
- [ ] **Reconocimiento facial real** (Teachable Machine) con verificación de vida (mirar arriba, girar, parpadear). La tabla `reconocimiento_facial` ya existe en la base de datos.
- [ ] **Marca de entrega del almuerzo**: hoy "Consumido" se deduce de la fecha del menú (ADR 010).
- [ ] **Cierre de menús**: los menús de días pasados quedan en `activo` y nunca pasan a `completado`.
- [ ] **Compra de invitado**: se registra como `pagado` al confirmarla, aunque se paga en la caja. Para controlarlo se necesita una vista de cobro de invitados, que no tienen ficha y no aparecen en Grupos.
- [ ] **Visitas institucionales**: el backend y `VisitasInstitucionalesPage.tsx` existen, pero la página no está enlazada en el menú del Encargado. Hay una visita del 20 de octubre que sigue "programada" sin forma de cerrarla.
- [ ] **Inventario**:
  - Stock con 3 decimales (requiere migrar a `NUMERIC(12,3)`).
  - Costo promedio ponderado en las entradas.
  - Aviso automático de stock bajo y de materiales vencidos.
- [ ] **Recargas de saldo** (`movimientos_saldo`, `usuarios.saldo`) y **compras a proveedores** (`compras`, `compra_detalle`): las tablas existen pero la aplicación no tiene esos flujos.

## 7. Limpieza del repositorio
- [ ] Borrar `frontend/src/components/molecules/DemoBanner.tsx`: ningún archivo lo usa.
- [ ] El `package.json` y el `package-lock.json` de la raíz son restos de una estructura anterior.
- [ ] La carpeta externa `PROYECTO SENA/` tiene su propio `.git` residual; el proyecto real es `Poryecto-Fromativo-/`.
- [ ] Borrar las ramas remotas `BURBANO`, `KevinDEV`, `julianDEV` y `julianDEV-wip`: todo su contenido ya está en `main`.
- [ ] Quitar `fichas.vocero` y `fichas.cantidad_estudiantes` del esquema. El rol Vocero se eliminó y la app cuenta los aprendices desde `usuarios`. Hoy solo los escriben la semilla y el registro de aprendiz al crear una ficha nueva (`auth.controller.ts`), así que habría que ajustar ambos.
