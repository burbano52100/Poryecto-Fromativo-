# Registro de Decisiones de Arquitectura (ADR) — SARA

Este documento recopila las decisiones técnicas clave tomadas durante el desarrollo de SARA (antes GastroSENA), la justificación de cada una y las alternativas evaluadas y descartadas.

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


## ADR 016: Sin perfil invitado; Almuerzos Invitados registrados por el encargado
- **Fecha**: 2026-11-16
- **Estado**: Aceptada (reemplaza el registro de invitados de los ADR 007 y 015)
- **Contexto**: El perfil "invitado" obligaba a una persona externa a crear una cuenta para comprar un almuerzo a $8.000, y su compra quedaba `pagado` aunque se pagara en la caja (pendiente de la fase 6). En la práctica los almuerzos de externos los cobra el encargado en la ventanilla, a veces para un grupo, y con tarifas distintas según quién sea el invitado.
- **Decisión**:
  - Se elimina el perfil: el rol `invitado` sale del enum `rol_usuario`, de los tipos y esquemas del frontend y del backend, de las rutas (`#/invitado/inicio`) y del Menú del Día (`precio_invitado`). La migración 006 borra los usuarios invitados y sus datos sin tocar el resto de la base. El registro con `accountType: "invitado"` responde `400` y un token antiguo de invitado responde `401` (ADR 014).
  - Nueva sección del encargado, **Almuerzos Invitados**, con tres tipos de tarifa fija: instructores $10.000, aprendices $5.000 y corrientes $11.000. El encargado indica el **número de personas** y el total (personas × tarifa) se calcula en vivo. Tabla `almuerzos_invitados` (migración 007) con un registro por grupo.
  - Las tarifas y el máximo de personas por registro (500) se definen en un solo lugar, `backend/src/config/almuerzosInvitados.ts`. El frontend las lee de `GET /api/almuerzos-invitados/tarifas` y el servidor siempre cobra con ellas, ignorando cualquier precio del cliente.
  - Cada registro copia su `precio_unitario` y su `total` es una columna generada: si las tarifas cambian, el histórico no cambia. Al editar se puede corregir personas, nombre y fecha; el tipo y el precio guardado no cambian.
  - Los registros se pagan al registrarlos, así que suman en Ventas como cobrados: almuerzos servidos, ingresos, gráfico y transacciones, con desglose por tipo. El encabezado del panel también los incluye.
  - El precio por defecto de una visita institucional, que antes salía de `precio_invitado`, ahora es la tarifa `corriente`.
- **Alternativas descartadas**:
  - *Tarifas en una tabla de configuración editable*: requiere pantalla y permisos para editarla. Con una constante en el backend basta un cambio de código, y la tabla se puede agregar después sin cambiar los registros.
  - *Conservar el rol invitado sin usarlo*: deja código y datos muertos y la posibilidad de crear cuentas que ya no tienen panel.

## ADR 024: Almuerzos especiales por contrato
- **Fecha**: 2026-11-24
- **Estado**: Aceptada
- **Contexto**: El encargado del comedor contó que el menú es el mismo para todos, salvo cuando una dependencia del SENA pide almuerzos especiales: Bienestar al Aprendiz, la Regional o Dirección General, casi siempre para directivos y bajo un contrato. Ese menú cambia y el precio es más alto. No encaja en Almuerzos Invitados (ventanilla, tarifa fija, pago inmediato) ni en Visitas institucionales (menú normal a precio fijo).
- **Decisión**:
  - Sección nueva del encargado, **Almuerzos especiales**, con la tabla `almuerzos_especiales` (migración 018). Cada pedido guarda quién lo pide, el responsable, el número de contrato (opcional), la fecha, las personas, qué se sirve, una receta opcional y el precio por persona. El total (personas × precio) es una columna generada.
  - Flujo: `programado` → `entregado` → pagado. Mientras está programado se puede cancelar; entregado ya no.
  - Al marcarlo entregado (el día del pedido o después) se descuentan de la bodega los ingredientes de su receta por cada persona (ADR 020), con `referencia_tipo = 'almuerzo_especial'` en el kardex. Sin receta no se descuenta nada y la respuesta lo avisa.
  - El pago se registra cuando el contrato paga, y solo después de la entrega. Desde ese momento cuenta en Ventas por la fecha del pago: totales, gráfico (tercer color) y transacciones (`origen = 'especial'`, con la dependencia y el contrato). También suma en las ventas de hoy del encabezado del encargado.
  - No entra al cierre de caja: el contrato no paga en efectivo en la ventanilla.
- **Pendiente relacionado**: la porción del aprendiz, la del instructor y la del visitante son distintas. El descuento por receta todavía usa la misma cantidad para todos; se ajustará cuando cocina dé las medidas.
- **Alternativas descartadas**:
  - *Un tipo "especial" dentro de Visitas institucionales*: mezcla dos procesos distintos (quién pide, cómo se cobra y qué se sirve).
  - *Contarlo en Ventas el día de la entrega*: mostraría como cobrado un dinero que el contrato todavía no ha pagado.

## ADR 025: Precio del almuerzo para instructores
- **Fecha**: 2026-11-24
- **Estado**: Aceptada
- **Contexto**: El aprendiz y el instructor pagan precios distintos por el mismo almuerzo. El menú solo tenía `precio_aprendiz` y el instructor pagaba ese mismo valor; solo Almuerzos invitados distinguía tarifas (ADR 016).
- **Decisión**:
  - Cada menú guarda `precio_instructor` (migración 019) y el encargado lo escribe al publicarlo, junto al de aprendices. El formulario arranca en $10.000, la tarifa de instructores de Almuerzos invitados.
  - La reserva del instructor se cobra con ese precio y suma ese valor a su deuda mensual. `GET /api/menus/activo` le muestra su precio en `precio_aplicable`.
  - `NULL` significa "el mismo precio del aprendiz": así quedan los menús publicados antes, que se cobraron así. Las ventas guardan su `precio_cobrado`, así que el histórico y las deudas ya registradas no cambian.
- **Alternativa descartada**: *una tarifa fija en el código, como en Almuerzos invitados*. El precio del aprendiz ya se define en cada menú; poner el del instructor al lado evita tener dos lugares distintos para lo mismo.
