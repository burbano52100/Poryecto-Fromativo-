# Arquitectura y Estructura del Frontend - GastroSENA

El frontend de GastroSENA está construido con **React 19**, **TypeScript estricto**, **Vite**, **Tailwind CSS v4** y **HeroUI v3** (`@heroui/react` + `@heroui/styles`), siguiendo **Atomic Design**. Los datos vienen siempre de la API del backend mediante **TanStack React Query v5** y **Axios**; no hay datos simulados en los componentes.

### Sistema de diseño (HeroUI v3)
- Toda la interfaz usa componentes de HeroUI: `Button`, `Card`, `Chip`, `Table`, `Select`, `Tabs`, `Modal`, `AlertDialog`, `Drawer`, `Alert`, `Skeleton`, `Avatar`, `SearchField`, `Checkbox`, `ToggleButtonGroup`, `Tooltip`, `Accordion`, `Pagination`, etc.
- El tema está en `src/index.css`: `@import "@heroui/styles"` después de Tailwind y el acento (`--accent`) en el verde del SENA. Para colores se usan los tokens de HeroUI (`bg-surface`, `text-muted`, `bg-accent-soft`, `text-danger`…), no la paleta de Tailwind.
- Tipografía: Inter (`@fontsource-variable/inter`, sin depender de Google Fonts).
- Avisos de éxito con `toast.success(...)` de HeroUI (el `Toast.Provider` está en `main.tsx`); los errores siguen como `Alert` dentro de la sección. En los tests, `renderConProveedores` incluye el `Toast.Provider` y `setup.ts` simula `ResizeObserver`, que jsdom no trae.
- La documentación de HeroUI se consulta con su servidor MCP `@heroui/react-mcp` (configurado en `.mcp.json`).
- No usar `<ErrorMessage>` ni `<Description>` de HeroUI sueltos fuera de un campo de React Aria: dentro de un `Modal` el de error lanza "Invalid slot". Para eso está el átomo `FieldMessage`.

---

## 🌳 Árbol General de Directorios

```
frontend/
├── docs/                   # Documentación técnica obligatoria del frontend
├── public/                 # Estáticos (logo, fondo del comedor, favicons)
├── src/
│   ├── components/         # Atomic Design
│   │   ├── atoms/
│   │   ├── molecules/
│   │   ├── organisms/
│   │   │   └── inventario/ # Las cinco sub-vistas de Inventario
│   │   └── templates/
│   ├── hooks/              # Un archivo por dominio de la API (React Query)
│   ├── lib/                # Cliente HTTP, sesión, formato, assets, CSV
│   ├── pages/              # Un panel por rol + login
│   ├── routes/             # ProtectedRoute
│   ├── schemas/            # Esquemas Zod de formularios
│   ├── test/               # Configuración y utilidades de Vitest
│   ├── types/              # Contratos de respuesta de la API (api.ts)
│   ├── App.tsx             # HashRouter, rutas por rol y lazy loading
│   └── main.tsx            # Punto de entrada y QueryClientProvider
├── vite.config.ts          # base '/Poryecto-Fromativo-/' y configuración de Vitest
└── package.json
```

---

## 🧩 Capas

### `components/atoms/`
- `Button`: el `Button` de HeroUI con un `Spinner` mientras `isPending`.
- `StatCard`: `Card` de métrica; con `value` indefinido muestra un `Skeleton`.
- `Hueso`: pieza de `Skeleton` sin animación propia; el contenedor con `skeleton--shimmer` pone un solo brillo para todas (patrón "Single Shimmer" de HeroUI).
- `EstadoPagoBadge`: `Chip` Pagado / Pendiente / Gratis con el mismo color en todos los paneles.
- `FieldMessage`: texto de error o de ayuda bajo un campo, con las clases de HeroUI.

### `components/molecules/`
- `FormField` / `TextAreaField`: `Label` + `Input`/`InputGroup`/`TextArea` de HeroUI sin controlar (funcionan con `register` de react-hook-form).
- `SelectField`: `Select` + `ListBox` de HeroUI para opciones de texto (con react-hook-form, vía `Controller`).
- `SearchInput`: `SearchField` de HeroUI con botón para limpiar.
- `SectionCard`: `Card` estándar de cada sección (título, descripción y acciones).
- `ListSkeleton` (formas `lista`, `tabla` y `tarjetas`) y `EmptyMessage`: estado de carga y lista vacía (`EmptyState`).
- `MenuCard`: menú del día con precio, disponibilidad, motivo si no se puede reservar y estado de la reserva propia.
- `ConsumoRow`: un almuerzo del historial (Reservado/Consumido + estado de pago).
- `ConfirmDialog` (`AlertDialog`, `role="alertdialog"`) y `FormModal` (`Modal`, `role="dialog"`).
- `ErrorAlert`: `Alert` con el `message` que envía el backend y "Reintentar" opcional.
- `NumberStepper`: entero con botones − y + en un `InputGroup` (número de personas de Almuerzos Invitados).
- `AccountTypeSelector` (`ToggleButtonGroup` Aprendiz / Instructor), `CuentaMensualCard`, `SidebarNavItem`, `SidebarUserProfile`, `ScheduleCard`, `ProgressCard`.

### `components/organisms/`
- **Login:** `LoginForm`, `RegisterModal`, `Header`, `HelpModal`.
- **Compartidos:** `Sidebar`, `CifrasDelPerfil` (cifras de cada perfil, cada una dentro de su sección), `ReservaAlmuerzoCard` (flujo de reserva de Aprendiz e Instructor), `BuzonSugerenciasSection`, `PerfilSection`.
- **Aprendiz:** `InicioSection`, `MisFichasSection`.
- **Instructor:** `MiCuentaSection`, `ConsumosSection`.
- **Encargado:** `VentasSection`, `MenuDelDiaEncargadoSection`, `AlmuerzosInvitadosSection` → `almuerzosInvitados/RegistroAlmuerzoInvitadoCard`, `ResumenAlmuerzosInvitados`, `HistorialAlmuerzosInvitados`, `EditarAlmuerzoInvitadoModal`, `BeneficiariosSection`, `CarteraDeudasSection`, `GruposSection`, `BuzonSugerenciasEncargadoSection`, `InventarioSection` → `inventario/StockView`, `RecetasView`, `KardexView`, `MermasView`, `ConfiguracionView`.

### `components/templates/`
- `AuthLayout`: fondo del comedor con capa oscura para el login.
- `DashboardLayout`: sidebar (fija en escritorio, `Drawer` en móvil), barra superior con `Breadcrumbs` en Inventario y menú de la cuenta (`Dropdown` sobre el `Avatar` con `Badge` de estado). Las cifras de cada perfil van dentro de su sección, no encima de todas.
- `DashboardSkeleton`: forma del panel mientras se verifica la sesión o se descarga el panel del rol.

### `hooks/`
| Archivo | Endpoints |
|---|---|
| `queryKeys.ts` | Claves de React Query e intervalo "en vivo" del Encargado |
| `useAuth.ts` | `/auth/login`, `/auth/register`, `/auth/me`, cierre de sesión |
| `useMenu.ts` | `/menus/activo`, `/menus`, `/consumos/reservar` |
| `useConsumos.ts` | `/consumos`, `/consumos/resumen` |
| `useVentas.ts` | `/ventas`, `/dashboard/encargado` |
| `useCartera.ts` | `/deudas`, `/deudas/mi-cuenta`, `/deudas/:id/pagar` |
| `useGrupos.ts` | `/grupos`, `/grupos/:id/aprendices`, `/grupos/ventas/:id/pago` |
| `useBeneficiarios.ts` | `/beneficiarios/estudiantes`, `/beneficiarios/:id` |
| `useSugerencias.ts` | `/sugerencias`, `/sugerencias/:id/responder` |
| `useInventario.ts` | `/inventario/*` |
| `usePerfil.ts` | `/perfil` |

### `lib/`
- `api.ts`: instancia de Axios con JWT y manejo del 401; `mensajeDeError()`.
- `session.ts`: token y usuario en `localStorage`, evento `gastrosena:logout`.
- `authService.ts`: llamadas de autenticación.
- `assets.ts`: `asset()` y `resolverImagen()` para respetar la base de Vite en GitHub Pages.
- `formato.ts`: pesos colombianos y fechas en hora de Colombia.
- `csv.ts`: exportación CSV (Cartera y Ventas).

### `schemas/` y `types/`
- `schemas/auth.schema.ts`: login (documento y contraseña), registro y usuario.
- `schemas/inventario.schema.ts`: materiales, entradas, salidas, recetas y mermas.
- `types/api.ts`: contratos de respuesta del backend (ver `docs/API.md` en la raíz).

### `test/`
- `setup.ts` (jest-dom y limpieza) y `utils.tsx` (`renderConProveedores`, `usuarioDePrueba`, `respuesta`).
- Los tests viven junto al código: `App.test.tsx`, `lib/assets.test.ts`, `organisms/*.test.tsx`. Se corren con `npm test`.
