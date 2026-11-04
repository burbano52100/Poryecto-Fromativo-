# Pendientes para completar GastroSENA

Estado al **4 de noviembre de 2026**, en la rama `integracion/pendientes`. Lo ya hecho está en [PROGRESO.md](PROGRESO.md) y las decisiones en [DECISIONES.md](DECISIONES.md).

## Resultado de la última verificación (4 de noviembre)

| Prueba | Resultado |
|---|---|
| Backend: `npm run lint`, `npm run build`, `npm test` | ✅ 142/142 tests contra PostgreSQL real |
| Frontend: `npm run lint`, `npm run build`, `npm test` | ✅ 54/54 tests |
| Recorrido en Chrome de los 4 paneles (25 secciones), en escritorio y celular | ✅ Sin errores de API ni de JavaScript y sin desborde horizontal |
| Flujos en Chrome sobre la base de tests: solicitar cuenta, aprobar, rechazar y registrar una visita | ✅ |
| `npm audit` (backend y frontend) | ✅ 0 vulnerabilidades |

### Resuelto en esta fase
- Contadores fijos del Sidebar del Encargado: ahora salen de la API.
- El rate limit del login ya no cuenta los ingresos exitosos.
- Un token ya no sirve si la cuenta se desactiva, y el rol sale de la base de datos (ADR 014).
- `npm audit fix` en los dos proyectos.
- Semilla: fecha de Colombia, porciones reales y deudas que cuadran con las ventas.
- Registro de instructor y encargado con aprobación del encargado (ADR 015).
- Visitas institucionales enlazadas en el panel del Encargado.
- Se eliminó `DemoBanner.tsx`, que no se usaba.

---

## 1. Para integrar
- [ ] Fusionar `integracion/pendientes` en `main` con *merge commit*, para que GitHub marque también el PR #1 como fusionado. La CI corre lint, build y tests de las dos carpetas.
- [ ] En cada base existente, correr la migración 005 (`npm run db:init` en local; en Render se aplica sola al arrancar).

## 2. Despliegue (configuración manual, requiere acceso a las cuentas)
- [ ] En Render: crear el Blueprint desde `render.yaml` y cargar `ADMIN_DOCUMENT`, `ADMIN_PASSWORD` y `ADMIN_EMAIL`.
- [ ] En GitHub → Settings → Variables: crear `VITE_API_URL` con la URL del backend en Render terminada en `/api`.
- [ ] Recordar que la base gratuita de Render expira a los 30 días (ver `DESPLIEGUE.md`).

## 3. Datos de tu base de desarrollo
- [ ] La base local `gastrosena` todavía tiene los datos de la semilla anterior: deudas que no cuadran con las ventas y porciones vendidas infladas. La semilla nueva no borra datos. Para dejarla limpia hay que vaciarla y volver a sembrarla (`npm run db:init` y `npm run db:seed`), lo cual **borra los datos actuales**. Decide si te sirve.

## 4. Mejoras funcionales
- [ ] **Visitas institucionales**: se pueden registrar y listar, pero no hay endpoint para marcarlas como realizadas, canceladas o pagadas. La visita del 20 de octubre de la base local sigue "programada".
- [ ] **Superadministrador (opcional)**: hoy cualquier encargado aprueba solicitudes de encargado (ADR 015). Si se quiere que solo el Encargado General apruebe encargados, hay que agregar esa distinción.
- [ ] **Reconocimiento facial real** (Teachable Machine) con verificación de vida (mirar arriba, girar, parpadear). La tabla `reconocimiento_facial` ya existe en la base de datos.
- [ ] **Marca de entrega del almuerzo**: hoy "Consumido" se deduce de la fecha del menú (ADR 010).
- [ ] **Cierre de menús**: los menús de días pasados quedan en `activo` y nunca pasan a `completado`.
- [ ] **Compra de invitado**: se registra como `pagado` al confirmarla, aunque se paga en la caja. Para controlarlo se necesita una vista de cobro de invitados, que no tienen ficha y no aparecen en Grupos.
- [ ] **Inventario**:
  - Stock con 3 decimales (requiere migrar a `NUMERIC(12,3)`).
  - Costo promedio ponderado en las entradas.
  - Aviso automático de stock bajo y de materiales vencidos.
- [ ] **Recargas de saldo** (`movimientos_saldo`, `usuarios.saldo`) y **compras a proveedores** (`compras`, `compra_detalle`): las tablas existen pero la aplicación no tiene esos flujos.

## 5. Limpieza del repositorio
- [ ] El `package.json` y el `package-lock.json` de la raíz son restos de una estructura anterior. No los borré por si alguien los usa; revisar y eliminar.
- [ ] La carpeta externa `PROYECTO SENA/` tiene su propio `.git` residual; el proyecto real es `Poryecto-Fromativo-/`.
- [ ] Borrar las ramas remotas `BURBANO`, `KevinDEV`, `julianDEV` y `julianDEV-wip`: todo su contenido ya está en `main`. Después de fusionar, también las ramas `chore/quitar-facial-login`, `fix/cerrar-sesion`, `fix/campos-solo-numeros`, `feat/grupos-por-reservas` e `integracion/pendientes`.
- [ ] Quitar `fichas.vocero` y `fichas.cantidad_estudiantes` del esquema. Hoy solo los escriben la semilla y el registro de aprendiz al crear una ficha nueva; es una migración que borra columnas.
