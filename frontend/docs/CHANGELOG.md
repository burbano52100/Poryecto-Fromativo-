# Bitácora de Cambios (CHANGELOG) - Frontend GastroSENA

Registro cronológico detallado de arquitectura, características, refactorizaciones y correcciones en la aplicación frontend de GastroSENA.

---

## [2026-11-04] - Registro de instructor y encargado con aprobación del encargado

### Rama: `integracion/pendientes`

- **Motivo:** No había forma de crear instructores ni encargados desde la aplicación. El registro solo ofrecía Aprendiz e Invitado (ADR 003) y no existía ningún flujo de aprobación (ADR 015).
- **Cambios realizados:**
  - `AccountTypeSelector.tsx`: los 4 tipos de cuenta en una cuadrícula de 2×2.
  - `RegisterModal.tsx`:
    - Para instructor y encargado muestra un aviso de aprobación, el botón dice "Enviar solicitud" y no pide ficha.
    - Al enviar no inicia sesión: muestra "Solicitud enviada" y espera a que la persona presione "Entendido".
    - El texto de la contraseña ahora dice "Mínimo 8 caracteres", como exige la validación (antes decía 4).
    - El ejemplo de correo cambia según el tipo de cuenta.
  - `schemas/auth.schema.ts`: `requiereAprobacion`, `SolicitudResponse`, `RegisterResponse` y `esSolicitud`.
  - `useRegisterMutation`: solo inicia sesión si la respuesta trae token.
  - `LoginForm`: muestra el aviso 403 de solicitud pendiente o rechazada (con el motivo) que envía el backend.
  - Panel del Encargado:
    - Nueva sección `SolicitudesCuentaSection` con pestañas "Pendientes" e "Historial".
    - Aprobar abre un `ConfirmDialog`, que advierte cuando se trata de un encargado.
    - Rechazar abre un `FormModal` con motivo opcional.
    - Hooks en `hooks/useSolicitudes.ts`.
    - Ítem "Solicitudes de Cuenta" en el Sidebar, con su contador.
- **Tests:** `RegisterModal.test.tsx`, `SolicitudesCuentaSection.test.tsx`, el aviso 403 en `App.test.tsx` y el contador en `Sidebar.test.tsx`.

---

## [2026-11-03] - Corrección: contadores fijos en el Sidebar del Encargado

### Rama: `integracion/pendientes`

- **Motivo:** En la prueba completa del proyecto, el Sidebar mostraba "Cartera de Deudas 3" y "Buzón de Sugerencias 2" mientras el encabezado decía "2 cuenta(s) por cobrar" y "3 pendientes". Esos contadores eran valores fijos que quedaron de los datos simulados.
- **Cambios realizados:**
  - `Sidebar.tsx`: los contadores salen de `GET /api/dashboard/encargado`, la misma consulta y la misma caché que usa el encabezado, así que no hay una petición extra. Si no hay pendientes, el contador no aparece.
  - `hooks/useVentas.ts`: `useResumenEncargado(enabled)` permite que los demás roles no hagan la consulta.
- **Tests:** `Sidebar.test.tsx` comprueba los contadores desde la API, que no aparezcan cuando no hay pendientes y que los otros roles no hagan la consulta.

---

## [2026-11-02] - Grupos: una ficha por fila, ordenadas por reservas de hoy

### Rama: `feat/grupos-por-reservas`

- **Motivo:** Las fichas salían en dos columnas angostas y en orden de número de ficha. Al encargado le sirve ver primero las que más almuerzos reservaron.
- **Cambios realizados:**
  - `GruposSection.tsx`:
    - Cada ficha ocupa una fila a lo ancho, con su puesto (1, 2, 3...).
    - A la izquierda van ficha, jornada, programa, instructor y aprendices.
    - A la derecha, tres cifras grandes: "Reservas hoy", "Al día" y "Sin pagar" (en rojo si hay pendientes).
    - En el celular las cifras van debajo y se reparten el ancho.
  - `ordenarPorReservas`: de más a menos reservas de hoy. Si empatan, primero la que tiene más pendientes de pago, y luego por número de ficha. El orden se actualiza solo con el refresco de cada 30 s.
  - El buscador es más ancho, para que se lea completo "Buscar por ficha, programa o instructor...".
- **Tests:** `GruposSection.test.tsx` comprueba el orden con fichas que llegan desordenadas, incluido el empate.

---

## [2026-11-02] - Campos numéricos: solo aceptan números

### Rama: `fix/campos-solo-numeros`

- **Motivo:** Campos como "Cantidad" en la salida de inventario dejaban escribir letras. El error solo aparecía al enviar el formulario.
- **Cambios realizados:**
  - `lib/numeros.ts`:
    - `limpiarNumero` quita lo que no sea número. En modo decimal deja un solo separador y convierte la coma en punto ("2,5" → "2.5").
    - `soloNumeros(register(...), modo)` aplica ese filtro a un campo de React Hook Form mientras se escribe o se pega, sin mover el cursor, y abre el teclado numérico en el celular.
  - Modo `decimal` en:
    - Inventario/Stock: stock inicial, stock mínimo, costo unitario y las cantidades y costos de entradas y salidas.
    - Recetas: cantidad de cada ingrediente.
    - Mermas: cantidad perdida.
  - Modo `entero` en:
    - Recetas: precio de venta.
    - Menú del Día: precio aprendiz, precio invitado y porciones.
    - Documento de identidad en el login y en el registro.
  - `CarteraDeudasSection`: el abono deja de ser `type="number"` (permitía `e`, `+` y `-`) y usa el mismo filtro.
- **Tests:** `lib/numeros.test.tsx` y `inventario/StockView.test.tsx` (en la salida, "n2,5L" queda como 2.5 y se envía como número).

---

## [2026-11-02] - Corrección: "Cerrar Sesión" no volvía al login

### Rama: `fix/cerrar-sesion`

- **Motivo:** Al hacer clic en "Cerrar Sesión" del Sidebar, o al recibir un 401, la pantalla seguía en el panel hasta recargar con F5. `useLogout` llamaba a `queryClient.clear()`, que borraba la consulta `['currentUser']`; `ProtectedRoute` seguía observando la consulta eliminada y no se enteraba del `null`.
- **Cambios realizados:**
  - `hooks/useAuth.ts`: `useLogout` limpia `localStorage`, pone `['currentUser']` en `null` y luego descarta con `removeQueries` las demás consultas, sin tocar la de sesión.
  - `App.test.tsx`: tests de "Cerrar Sesión" en los 4 paneles y del evento `gastrosena:logout`. Comprueban que aparece el login sin recargar, que se borra el token y que no queda ningún dato del usuario anterior en caché. Los paneles simulados ahora incluyen el `Sidebar` real.
  - `test/utils.tsx`: helper `panelDePrueba`.
  - `docs/LOGIN_Y_REDIRECCIONAMIENTO.md`: sección "Qué hace `useLogout`".

---

## [2026-11-02] - Fase 5: login simplificado, HashRouter y paneles conectados a la API

### Rama: `julianDEV-front` (commits `de87ca4` y `41cae31`)

#### 1. Login y rutas
- **Motivo:** El rol ya lo decide el backend; los botones de tipo de cuenta, "Modo Invitado", facial y accesos de desarrollo confundían y el `DevQuickLogin` guardaba un token falso que provocaba 401.
- **Cambios realizados:**
  - `LoginForm.tsx`: solo documento, contraseña, "Ingresar" y "Registrarse". El backend devuelve el rol y la página redirige sola a `/{rol}/inicio`.
  - `App.tsx`: `HashRouter` + `lazy()` por panel + `ProtectedRoute` (sin sesión → `#/login`; otro rol → su propio panel). Se eliminó la barra "Rutas (DEV)".
  - `AuthLayout.tsx` y `Header.tsx`: fondo `cafeteria-bg.jpg` con capa oscura y logo `alt="GastroSENA"`, ambos con `asset()` (`import.meta.env.BASE_URL`) para GitHub Pages.
  - `RegisterModal.tsx` / `AccountTypeSelector.tsx`: el registro solo ofrece Aprendiz e Invitado.
  - `lib/api.ts`: el 401 de login/registro no cierra sesión; `useLogout` vacía la caché de React Query.
  - `tsconfig.app.json`: `"strict": true`.
- **Eliminados:** `DevQuickLogin.tsx`, `types/auth.ts`, `test_redirections.cjs`.

#### 2. Paneles sin datos mock
- **Motivo:** La mayoría de secciones usaban estado local simulado; una reserva del aprendiz nunca llegaba al Encargado.
- **Cambios realizados:**
  - Hooks por dominio en `src/hooks/` con React Query, claves en `queryKeys.ts` e invalidación cruzada. El Encargado refresca ventas, grupos, cartera y buzón cada 30 s.
  - `ReservaAlmuerzoCard.tsx`: reserva real para Aprendiz, Instructor e Invitado. El beneficiario reserva con un clic a $0; los demás confirman en un modal. Respeta horario (7:00–21:00), cupo y reserva existente.
  - `MisFichasSection` / `ConsumosSection`: estado Reservado/Consumido y Pagado/Pendiente/Gratis (`ConsumoRow`, `EstadoPagoBadge`).
  - `GruposSection`: la tarjeta completa despliega los aprendices que reservaron hoy con Pagado / No pagado.
  - `VentasSection`, `StatsHeader`, `CarteraDeudasSection`, `BuzonSugerencias*`, `PerfilSection`, `MenuDelDiaEncargadoSection`, `BeneficiariosSection`: conectados a la API, con estados de carga y error (`ErrorAlert`).
  - `InventarioSection`: dividido en `organisms/inventario/` (Stock, Recetas, Kardex, Mermas, Configuración) con formularios Zod (`schemas/inventario.schema.ts`).
- **Tests:** `App.test.tsx`, `lib/assets.test.ts`, `ReservaAlmuerzoCard.test.tsx`, `GruposSection.test.tsx` (Vitest + Testing Library, `npm test`).

---

## [2026-10-28] - Revisión de Seguridad, Limpieza de Credenciales y Módulo de Beneficiarios (Paso 5)

### Rama: `julianDEV-front`

#### 1. Seguridad Estricta en Producción (Cero Credenciales en Código)
- **Motivo:** Evitar que credenciales de prueba, contraseñas, cédulas o botones administrativos queden expuestos en el paquete final de producción (`dist/`).
- **Cambios realizados:**
  - `LoginForm.tsx`: Se eliminaron todos los valores por defecto prellenados (`ficha: ''`, `document: ''`, `password: ''`). Se removió la asignación automática de documentos de prueba en el selector de cuenta.
  - `HelpModal.tsx`: Se eliminó el bloque con cédula y contraseña `'demo123'`, reemplazándolo por instrucciones institucionales.
  - `DemoBanner.tsx`: Condicionado para devolver `null` fuera de `import.meta.env.DEV`.
  - `DevQuickLogin.tsx`: Se aisló el componente de acceso rápido de prueba para que solo se evalúe cuando `import.meta.env.DEV` es verdadero. En `npm run build`, Rollup aplica *dead-code elimination* y no incluye ni los botones ni las cadenas de texto en el JS de producción.
  - `dist/`: Verificado con búsqueda de cadenas (`Select-String`) confirmando 0 ocurrencias de botones o credenciales demo.
- **Archivos tocados:**
  - `frontend/src/components/organisms/LoginForm.tsx`
  - `frontend/src/components/organisms/DevQuickLogin.tsx`
  - `frontend/src/components/organisms/HelpModal.tsx`
  - `frontend/src/components/molecules/DemoBanner.tsx`

#### 2. Guardia de Navegación y Login con Redireccionamiento Automático (Casos 5a, 5b, 5c, 5d)
- **Motivo:** Garantizar que los usuarios autenticados sean dirigidos a su dashboard correspondiente, que usuarios no autorizados no accedan a paneles de otros roles y que tokens vencidos fuercen el cierre de sesión inmediato.
- **Comportamiento:**
  - **Caso 5.a:** Con sesión activa, acceder a `/` o `/login` redirige automáticamente a `/${rol}/inicio`.
  - **Caso 5.b:** Un aprendiz u otro rol que intente acceder a `/encargado/inicio` es interceptado y redirigido a su panel autorizado (`/${rol}/inicio`).
  - **Caso 5.c:** Sin sesión activa (`!isAuthenticated`), el intento de abrir cualquier ruta protegida redirige a `/login`.
  - **Caso 5.d:** Ante una respuesta HTTP 401 (token expirado o inválido), el interceptor de Axios en `api.ts` limpia el `localStorage` y emite el evento global `gastrosena:logout`, reseteando React Query y volviendo a `/login`.
  - Barra de depuración de rutas (`Rutas (DEV)`) restringida exclusivamente a `import.meta.env.DEV`.
- **Archivos tocados:**
  - `frontend/src/App.tsx`
  - `frontend/src/lib/api.ts`
  - `frontend/test_redirections.cjs`

#### 3. Optimización Visual, Logo y Fondo de Cafetería
- **Motivo:** Incorporar la identidad visual del proyecto sin degradar el rendimiento web y soportar pantallas móviles pequeñas (360px).
- **Cambios realizados:**
  - Se optimizó la fotografía `public/cafeteria-bg.jpg` mediante codificación JPEG con calidad web al 75%, reduciendo su peso de **492.8 KB a 161.5 KB** (disminución del 67%, muy por debajo del umbral de 300 KB).
  - En `AuthLayout.tsx` se incorporó el color de respaldo `bg-emerald-950` para evitar destellos blancos durante la carga de la imagen de fondo, y se ajustó el contenedor a escala fluida para pantallas desde 360px.
  - En `Header.tsx` se enmarcó el logo oficial circular `public/logo.png` con `aspect-square`, `object-contain` y borde verde estilizado, impidiendo deformaciones en cualquier resolución.
- **Archivos tocados:**
  - `frontend/public/cafeteria-bg.jpg`
  - `frontend/public/logo.png`
  - `frontend/src/components/templates/AuthLayout.tsx`
  - `frontend/src/components/organisms/Header.tsx`

#### 4. Implementación del Paso 5 – Módulo de Beneficiarios
- **Motivo:** Cumplir el requerimiento del Paso 5 para que el Encargado administre los subsidios al 100% y los aprendices beneficarios reserven a $0 con un solo clic.
- **Cambios realizados:**
  - **Encargado:** Nuevo ítem en `Sidebar.tsx` ("Beneficiarios", acento ámbar institucional, ícono `Award`). Componente `BeneficiariosSection.tsx` con dos vistas: "Todos los estudiantes registrados" (con buscador en tiempo real, filtro por ficha y botón para asignar subsidio) y "Beneficiarios actuales" (con botón para quitar subsidio y modal de confirmación explicando que el precio vuelve a $5.000 para reservas futuras).
  - **Aprendiz:** Los beneficiarios conservan su perfil de Aprendiz (`role = 'aprendiz'`). Visualizan el badge "Beneficiario" en el banner de bienvenida y en `MenuCard.tsx`, precio en $0 COP (subsidio 100%) y botón directo de reserva a 1 solo clic.
  - **Lógica de precios:** La tarifa $0 la dictamina el backend al procesar la reserva; el frontend la presenta según la marca `es_beneficiario`.
  - **Hook `useBeneficiarios.ts`:** Preconfigurado con llamadas a `GET /beneficiarios/estudiantes`, `GET /beneficiarios` y `PATCH /beneficiarios/:usuarioId`, con persistencia en `localStorage` como fallback transparente mientras se habilitan las rutas en el backend.
- **Archivos tocados:**
  - `frontend/src/components/organisms/Sidebar.tsx`
  - `frontend/src/components/organisms/BeneficiariosSection.tsx`
  - `frontend/src/pages/EncargadoDashboardPage.tsx`
  - `frontend/src/components/molecules/MenuCard.tsx`
  - `frontend/src/components/organisms/InicioSection.tsx`
  - `frontend/src/pages/AprendizDashboardPage.tsx`
  - `frontend/src/hooks/useBeneficiarios.ts`
  - `frontend/src/schemas/auth.schema.ts`
  - `frontend/src/types/database.ts`

---

## [2026-10-15 al 2026-10-27] - Paneles de Roles, React Query v5 y Estilos Base

### Cambios previos consolidados:
- **Diseño del Sidebar por Rol:**  
  Adopción de fondo blanco institucional con acentos de color dedicados según el perfil:
  - **Aprendiz:** Verde esmeralda (`emerald-600`)
  - **Instructor:** Índigo (`indigo-600`)
  - **Encargado:** Ámbar (`amber-600`)
  - **Invitado:** Cerceta (`teal-600`)
  Soporte para acordeón colapsable en Inventario (5 subsecciones: Stock, Recetas, Kardex, Mermas, Configuración) y menú móvil responsivo.
- **Adopción de TanStack React Query v5:**  
  Migración de llamadas asíncronas a hooks reactivos con claves estructuradas: `useAuth`, `useCartera`, `useGrupos`, `useInventario`, `useSugerencias`.
- **Estructura Atómica:**  
  Organización de componentes en Atoms, Molecules, Organisms y Templates.
