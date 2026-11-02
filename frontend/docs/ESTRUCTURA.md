# Arquitectura y Estructura del Frontend - GastroSENA

El frontend de GastroSENA está construido con **React 19**, **TypeScript estricto**, **Vite** y **Tailwind CSS v4**, siguiendo **Atomic Design**. Los datos vienen siempre de la API del backend mediante **TanStack React Query v5** y **Axios**; no hay datos simulados en los componentes.

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
- `Button`, `Input`, `Label`, `Badge`, `StatCard`, `LoadingSpinner`.
- `EstadoPagoBadge`: Pagado / Pendiente / Gratis con el mismo color en todos los paneles.
- `AccountTypeButton`: botón de tipo de cuenta del **registro** (el login ya no pide tipo de cuenta).

### `components/molecules/`
- `FormField`: `Label` + `Input` asociados (`htmlFor`/`id`) + mensaje de error.
- `MenuCard`: menú del día con precio, disponibilidad, motivo si no se puede reservar y estado de la reserva propia.
- `ConsumoRow`: un almuerzo del historial (Reservado/Consumido + estado de pago).
- `ConfirmDialog` y `FormModal`: modales accesibles (Escape cierra, `role="dialog"`).
- `ErrorAlert`: muestra el `message` que envía el backend, con "Reintentar" opcional.
- `AccountTypeSelector` (solo Aprendiz/Invitado), `CuentaMensualCard`, `SidebarNavItem`, `SidebarUserProfile`, `ScheduleCard`, `ProgressCard`, `YamboroInfoCard`.

### `components/organisms/`
- **Login:** `LoginForm`, `RegisterModal`, `Header`, `HelpModal`.
- **Compartidos:** `Sidebar`, `StatsHeader` (indicadores reales por rol), `ReservaAlmuerzoCard` (flujo de reserva de Aprendiz, Instructor e Invitado), `BuzonSugerenciasSection`, `PerfilSection`.
- **Aprendiz:** `InicioSection`, `MisFichasSection`.
- **Instructor:** `MiCuentaSection`, `ConsumosSection`.
- **Invitado:** `InicioInvitadoSection`.
- **Encargado:** `VentasSection`, `MenuDelDiaEncargadoSection`, `BeneficiariosSection`, `CarteraDeudasSection`, `GruposSection`, `BuzonSugerenciasEncargadoSection`, `InventarioSection` → `inventario/StockView`, `RecetasView`, `KardexView`, `MermasView`, `ConfiguracionView`.

### `components/templates/`
- `AuthLayout`: fondo del comedor con capa oscura para el login.
- `DashboardLayout`: sidebar, barra superior y `StatsHeader`.

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
