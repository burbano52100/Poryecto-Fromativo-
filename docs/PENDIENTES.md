# Pendientes para completar GastroSENA

Estado al **2 de noviembre de 2026**, después de la Fase 5. Lo ya hecho está en [PROGRESO.md](PROGRESO.md) y las decisiones en [DECISIONES.md](DECISIONES.md).

## Resumen

| Área | Estado |
|---|---|
| Base de datos (PostgreSQL, migraciones 001–004) | ✅ Lista |
| Autenticación (login sin tipo de cuenta), roles por JWT, CORS, rate limit | ✅ Lista |
| Menú del día, reservas con horario, consumos, ventas, dashboard | ✅ Backend y frontend conectados |
| Beneficiarios ($0 con un clic) | ✅ Backend y frontend conectados |
| Grupos con control de pago por aprendiz | ✅ Backend y frontend conectados |
| Cartera de deudas (pago total o abono) | ✅ Backend y frontend conectados |
| Inventario (stock, recetas, kardex, mermas) | ✅ Backend y frontend conectados |
| Buzón de sugerencias entre roles | ✅ Backend y frontend conectados |
| HashRouter, rutas por rol, lazy loading | ✅ Listo |
| CI (`ci.yml`) y `render.yaml` | ✅ Listos |
| Tests | ✅ Backend y frontend (`npm test` en cada carpeta) |

---

## Pendiente para el despliegue (configuración manual, no es código)
- [ ] En Render: crear el Blueprint desde `render.yaml` y cargar `ADMIN_DOCUMENT`, `ADMIN_PASSWORD` y `ADMIN_EMAIL`.
- [ ] En GitHub → Settings → Variables: crear `VITE_API_URL` con la URL del backend en Render terminada en `/api`.
- [ ] Recordar que la base gratuita de Render expira a los 30 días (ver `DESPLIEGUE.md`).

## Verificación pendiente
- [ ] Revisión visual en navegador de los 4 paneles (celular y escritorio). La lógica está cubierta por tests y por una prueba de humo contra la API, pero la apariencia no se revisó en un navegador.

## Mejoras identificadas (fuera del alcance de la Fase 5)
- [ ] **Reconocimiento facial real** (Teachable Machine) con verificación de vida (mirar arriba, girar, parpadear). Hoy `POST /api/auth/facial-login` es una simulación de desarrollo y la interfaz no lo muestra.
- [ ] **Marca de entrega del almuerzo**: hoy "Consumido" se deduce de la fecha del menú (ADR 010).
- [ ] **Compra de invitado**: se registra como `pagado` al confirmarla, aunque se paga en la caja. Si se quiere controlar, se necesita una vista de cobro para invitados (no tienen ficha y no aparecen en Grupos).
- [ ] **Visitas institucionales**: el backend y `VisitasInstitucionalesPage.tsx` existen, pero la página no está enlazada en el menú del Encargado.
- [ ] **Inventario**: stock con 3 decimales (requiere migración a `NUMERIC(12,3)`), costo promedio ponderado en entradas y notificaciones automáticas de stock bajo.
- [ ] **Recargas de saldo** (`movimientos_saldo`, `usuarios.saldo`) y **compras a proveedores** (`compras`, `compra_detalle`): tablas sin flujo en la aplicación.
- [ ] Eliminar `fichas.vocero` y `fichas.cantidad_estudiantes` del esquema: ya no se usan (el rol Vocero se eliminó y el conteo se calcula desde `usuarios`).

## Limpieza del repositorio
- [ ] El `package.json` y `package-lock.json` de la raíz son restos de una estructura anterior.
- [ ] La carpeta externa `PROYECTO SENA/` tiene su propio `.git` residual; el proyecto real es `Poryecto-Fromativo-/`.
- [ ] Integrar o cerrar las ramas `KevinDEV`, `burbanoDEV` y `BURBANO`, que no se revisaron en esta fase.
