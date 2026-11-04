# Registro de Decisiones de Arquitectura (ADR) — GastroSENA

Este documento recopila las decisiones técnicas clave tomadas durante el desarrollo de GastroSENA, la justificación de cada una y las alternativas evaluadas y descartadas.

---

## ADR 001: Unificación de Motor en PostgreSQL
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: El repositorio contenía scripts de MySQL/SQLAlchemy (`database.py`, `models.py`) y un esquema detallado en PostgreSQL (`gastrosena_schema.sql`). Mantener dos motores generaba inconsistencias y fricción en despliegues.
- **Decisión**: Unificar exclusivamente en **PostgreSQL 14+**.
- **Consecuencias**: Se eliminaron los prototipos de SQLAlchemy/MySQL. Todo el backend interactúa mediante consultas parametrizadas con `pg`.
- **Alternativas descartadas**:
  - *MySQL*: Menor compatibilidad con Supabase/Render y types avanzados.
  - *SQLite*: No apto para despliegue en contenedores efímeros sin persistencia compartida.

---

## ADR 002: Sistema de Migraciones Versionadas y Runner Idempotente
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: En Render (plan gratuito) no existen hooks de pre-despliegue. Si la migración se ejecuta en cada inicio del servicio (`node dist/db/migrate.js && node dist/index.js`), debe ser estrictamente idempotente. `CREATE TYPE` en Postgres falla si el enum ya existe. Además, un solo archivo monolithic impediría evolucionar la base de datos sin romper instancias ya migradas.
- **Decisión**:
  1. Dividir las migraciones en archivos SQL numerados en `backend/src/db/migrations/` (`001_initial_schema.sql`, etc.).
  2. Implementar una tabla de control `schema_migrations (version text primary key, applied_at timestamptz default now())`.
  3. Ejecutar las migraciones pendientes dentro de una transacción.
  4. Generar automáticamente un bundle TypeScript (`migrationsMap.ts`) en el prebuild para que viaje compilado a `dist/` sin utilidades de copia externas.
- **Alternativas descartadas**:
  - *ORM pesado (Prisma/TypeORM)*: Demasiada sobrecarga y dependencias binarias para el monorepo.
  - *Un solo archivo `schema.sql`*: No permitía aplicar cambios incrementales en producción.

---

## ADR 003: Bootstrap Seguro del Primer Administrador en Producción
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: El seed con usuarios demo (`demo123`) es un riesgo de seguridad en servidores públicos. A su vez, el endpoint de auto-registro `/api/auth/register` prohíbe explícitamente registrar roles `encargado` o `instructor`. Por tanto, una base de datos desplegada en Render iniciaría sin administradores.
- **Decisión**: Implementar `bootstrapAdmin` al finalizar las migraciones. Si la tabla `usuarios` no contiene ningún usuario con rol `encargado`, y existen las variables de entorno `ADMIN_DOCUMENT` y `ADMIN_PASSWORD`, se inserta automáticamente el primer encargado con contraseña cifrada en bcrypt.
- **Alternativas descartadas**:
  - *Habilitar rol encargado en el formulario de registro*: Vulnerabilidad crítica que permite a cualquier usuario ganar privilegios.
  - *Correr el seed demo en producción*: Expone contraseñas conocidas (`demo123`) públicamente.

---

## ADR 004: HashRouter para Despliegue en GitHub Pages
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: GitHub Pages sirve sitios estáticos. Con `BrowserRouter` y la subruta base `/Poryecto-Fromativo-/`, al recargar una ruta como `/encargado/inicio` el servidor de GitHub responde 404 porque no existe un archivo HTML físico en esa subruta, requiriendo un truco con `404.html`.
- **Decisión**: Adoptar `HashRouter` (`#/login`, `#/aprendiz/inicio`, etc.).
- **Consecuencias**: Las recargas en cualquier página funcionan de forma transparente en GitHub Pages y en local, sin configuraciones complejas de rewrite.
- **Alternativas descartadas**:
  - *BrowserRouter con script de redirección 404.html*: Frágil, añade destellos de carga y problemas de sincronización de estado.
  - *Navegación manual con `window.history.pushState`*: No actualizaba correctamente la UI ni permitía botones de retroceso/avance del navegador.

---

## ADR 005: Almacenamiento de JWT en LocalStorage para Monorepo Cross-Domain
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: El frontend se aloja en `burbano52100.github.io` y el backend en `gastrosena-backend.onrender.com`. Al ser dominios distintos, las cookies `HttpOnly` requieren configuración de `SameSite=None; Secure`, políticas estrictas de CORS y enfrentan bloqueo por políticas de privacidad de navegadores modernos contra cookies de terceros.
- **Decisión**: Conservar el token JWT en `localStorage` y enviarlo mediante el encabezado `Authorization: Bearer <token>`.
- **Consecuencias**: Adecuado y estándar para este proyecto formativo distribuido entre GitHub Pages y Render.
- **Alternativas descartadas**:
  - *Cookies HttpOnly SameSite=None*: Bloqueadas frecuentemente por navegadores al estar frontend y backend en dominios distintos de nivel superior.

---

## ADR 006: Eliminación del Header de Confianza `x-user-role`
- **Fecha**: 2026-10-12
- **Estado**: Aceptada
- **Contexto**: El prototipo anterior confiaba en el header `x-user-role` enviado desde el cliente, permitiendo a cualquier aprendiz enviar `x-user-role: encargado` y acceder a funciones restringidas.
- **Decisión**: El middleware `requireRole` lee el rol **exclusivamente** desde el payload del JWT firmado y verificado con `JWT_SECRET`. Se eliminó el header `x-user-role` tanto en el cliente como en el servidor.

---

## ADR 007: Login solo con documento y contraseña
- **Fecha**: 2026-11-02
- **Estado**: Aceptada
- **Contexto**: El login pedía elegir el tipo de cuenta y, para aprendices, la ficha. El backend ya conoce el rol de cada usuario, y pedirlo en el formulario solo agregaba pasos y errores (un aprendiz que marcaba "Instructor" recibía "Credenciales inválidas").
- **Decisión**: `POST /api/auth/login` recibe `{ document, password }`. El rol sale de `usuarios.rol`, viaja en el JWT y en la respuesta, y el frontend redirige a `#/{rol}/inicio`. Cualquier `accountType` enviado se ignora. El mensaje de error sigue siendo genérico. El registro sí pide tipo de cuenta, pero solo ofrece Aprendiz e Invitado.

## ADR 008: Períodos de ventas "en curso" en hora de Colombia
- **Fecha**: 2026-11-02
- **Estado**: Aceptada
- **Decisión**: En `GET /api/ventas`, Día = hoy, Semana = desde el lunes, Mes = desde el día 1, y trimestre, semestre y año calendario, todos en `America/Bogota`. Se separan almuerzos servidos (incluye gratis), ingresos cobrados (`estado_pago = 'pagado'`) y por cobrar (`'pendiente'`).
- **Alternativa descartada**: últimos N días (por ejemplo, "Mes" = últimos 30 días), porque no coincide con los cortes que usa el comedor.

## ADR 009: Un pago de deuda marca las ventas más antiguas que alcanza a cubrir
- **Fecha**: 2026-11-02
- **Estado**: Aceptada
- **Contexto**: Pagar la deuda de un instructor no cambiaba el `estado_pago` de sus ventas, así que "por cobrar" en Ventas no cuadraba con la Cartera.
- **Decisión**: `POST /api/deudas/:id/pagar` corre en una transacción. Tras el abono, siguen pendientes las ventas más recientes cuyo total cubre el saldo restante; las demás pasan a `pagado`. Al saldar la deuda, todas quedan pagadas. Así, el total pendiente de las ventas nunca supera el saldo de la deuda en más de un almuerzo.

## ADR 010: "Reservado" y "Consumido" según la fecha del menú
- **Fecha**: 2026-11-02
- **Estado**: Aceptada
- **Contexto**: La base de datos no registra la entrega física del almuerzo.
- **Decisión**: Una reserva se muestra como **Reservado** mientras su menú sea de hoy o de un día futuro, y como **Consumido** cuando ese día ya pasó.
- **Alternativa descartada por ahora**: agregar una marca de entrega (migración nueva y un botón "Entregado" para el Encargado). Queda como mejora si se necesita controlar la entrega.

## ADR 011: Las reservas pendientes de aprendiz se guardan como `efectivo`
- **Fecha**: 2026-11-02
- **Estado**: Aceptada
- **Decisión**: Las reservas nuevas de aprendices no beneficiarios se guardan con `metodo_pago = 'efectivo'` y `estado_pago = 'pendiente'`, porque se pagan en la ventanilla. Antes se guardaban como `saldo`, que no se usa en ningún flujo. La interfaz muestra solo `estado_pago`. No se migraron los datos anteriores.

## ADR 012: Horario de reservas validado en el servidor
- **Fecha**: 2026-11-02
- **Estado**: Aceptada
- **Decisión**: `POST /api/consumos/reservar` solo acepta reservas de 7:00 a. m. a 9:00 p. m. (hora de Colombia) y responde `409` fuera de ese horario. `GET /api/menus/activo` informa `horario`, `reservable` y `motivo_no_reservable` para que el frontend deshabilite el botón con el motivo. Se usa el reloj de Node (`Date`) para poder fijarlo en los tests.

## ADR 013: PostgreSQL local, sin Docker
- **Fecha**: 2026-11-02
- **Estado**: Aceptada
- **Decisión**: Se eliminó `docker-compose.yml`. El desarrollo usa PostgreSQL instalado localmente, y la CI usa un servicio `postgres:16` de GitHub Actions.

## ADR 014: El token se valida contra la cuenta vigente
- **Fecha**: 2026-11-04
- **Estado**: Aceptada
- **Contexto**: El JWT dura 7 días y `authenticateToken` confiaba en él sin consultar la base. Una cuenta desactivada, o un encargado al que se le quitaba el rol, seguía entrando con su token hasta que vencía.
- **Decisión**: En cada petición protegida se busca al usuario por `id` (llave primaria) y se exige `activo = true`. `req.user`, incluido el rol, se arma con los datos de la base. Si la cuenta no existe o está inactiva responde `401`, y el frontend cierra la sesión.
- **Costo**: una consulta por llave primaria en cada petición, aceptable para el volumen del comedor.
- **Alternativa descartada**: tokens de pocos minutos con *refresh token*. Requiere más infraestructura y aun así deja una ventana abierta.
- **Relacionado**: el rate limit del login ahora cuenta solo los intentos fallidos (`skipSuccessfulRequests`), para que los aprendices que comparten la IP del wifi no se bloqueen entre sí.

## ADR 015: Cuentas de instructor y encargado por solicitud aprobada
- **Fecha**: 2026-11-04
- **Estado**: Aceptada (amplía los ADR 003 y 007)
- **Contexto**: El registro público solo permitía aprendiz e invitado. Abrirlo a encargado daría privilegios a cualquiera (ADR 003), pero no existía ninguna forma de crear instructores ni encargados desde la aplicación.
- **Decisión**:
  - El registro ofrece los 4 tipos de cuenta. Para instructor y encargado no se crea el usuario: se guarda una fila en `solicitudes_cuenta` (migración 005) con la contraseña ya cifrada, y se responde `202` sin token.
  - **Cualquier encargado** aprueba o rechaza desde la sección "Solicitudes de cuenta" de su panel. Al aprobar, se crea el usuario en la misma transacción.
  - Si la persona intenta entrar antes de la aprobación, con la contraseña correcta ve si su solicitud está pendiente o fue rechazada (con el motivo). Con una incorrecta recibe el error genérico de siempre.
  - Tabla aparte y no `usuarios.activo = false`: una cuenta pendiente nunca aparece en listas de instructores, fichas, cartera ni reportes, y "pendiente" no se confunde con "desactivada".
- **Alternativas descartadas**:
  - *Que solo el Encargado General apruebe encargados*: requiere distinguir un superadministrador (columna y reglas nuevas). Se puede agregar después sin cambiar la tabla.
  - *Que el encargado cree cuentas directamente*: obliga al encargado a conocer o inventar la contraseña de la otra persona.
