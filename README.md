# GastroSENA

Sistema web para reservar almuerzos en el SENA (Tecnoparque Yamboró, Pitalito, Huila). Proyecto formativo ADSO.

- **`frontend/`**: React 19 + TypeScript + Vite, Tailwind CSS 4, React Query, React Hook Form + Zod. Atomic design.
- **`backend/`**: API Express 5 + TypeScript sobre **PostgreSQL**, con migraciones versionadas.
- **`database/`**: diseño del modelo de datos (`database/README.md`).
- **`docs/`**: API, base de datos, decisiones, despliegue, progreso y pendientes.

`frontend/` y `backend/` son proyectos npm **independientes**. El `package.json` de la raíz es un resto de una estructura anterior; ignóralo.

## Roles

| Rol | Qué hace |
|---|---|
| Aprendiz | Reserva su almuerzo ($5.000; $0 si es beneficiario, con un clic), ve sus fichas y si están pagadas, usa el buzón. |
| Instructor | Reserva a crédito; su consumo se acumula en la Cartera de Deudas y lo ve en Mi Cuenta. |
| Encargado | Ventas, menú del día, beneficiarios, cartera, inventario, grupos (control de pago por aprendiz) y buzón. |
| Invitado | Compra el almuerzo a $8.000 y usa el buzón. |

El login pide **solo documento y contraseña**: el rol sale de la base de datos y la app abre el panel correspondiente. Las reservas se reciben de **7:00 a. m. a 9:00 p. m.** (hora de Colombia).

## Requisitos

- Node.js 22 (Vite 8 necesita 20.19+).
- PostgreSQL 14+ instalado localmente (sin Docker).

## Correrlo en local

1. Crea dos bases de datos: una de desarrollo y otra de tests (los tests la vacían en cada corrida).
   ```sql
   CREATE DATABASE gastrosena;
   CREATE DATABASE gastrosena_test;
   ```
2. Backend (http://localhost:3000):
   ```bash
   cd backend
   cp .env.example .env      # ajusta DATABASE_URL, DATABASE_URL_TEST y JWT_SECRET
   npm install
   npm run db:init           # aplica las migraciones y crea el primer encargado (ADMIN_*)
   npm run db:seed           # opcional: datos de demostración
   npm run dev
   ```
3. Frontend, en otra terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Abre **`http://localhost:5173/Poryecto-Fromativo-/`**. La ruta final es obligatoria porque `vite.config.ts` fija `base: '/Poryecto-Fromativo-/'` para GitHub Pages. Las rutas usan hash: `#/login`, `#/aprendiz/inicio`, etc.

### Usuarios de demostración (`npm run db:seed`)

Todos con contraseña `demo123`:

| Rol | Documento |
|---|---|
| Aprendiz | `1005678901` |
| Instructor | `1098765432` |
| Encargado | `1012345678` |

El seed no corre en producción salvo que `SEED_DEMO=true`.

Las cuentas nuevas de **instructor** y **encargado** se piden desde "Registrarse" y quedan pendientes hasta que un encargado las apruebe en **Solicitudes de Cuenta** (ADR 015).

## Calidad

```bash
# backend/
npm run lint     # oxlint
npm run build    # bundle de migraciones + tsc
npm test         # Vitest contra PostgreSQL real (DATABASE_URL_TEST)

# frontend/
npm run lint
npm run build    # tsc -b && vite build
npm test         # Vitest + Testing Library
```

El workflow `.github/workflows/ci.yml` corre lint, build y tests de ambos proyectos en cada push a `main` y en cada pull request, con un servicio de PostgreSQL 16.

## Despliegue

- **Frontend** → GitHub Pages, automático en cada push a `main` (`.github/workflows/deploy.yml`). Requiere la variable de Actions `VITE_API_URL`.
- **Backend** → Render con el Blueprint `render.yaml`: crea la base PostgreSQL, conecta `DATABASE_URL` con `fromDatabase`, genera `JWT_SECRET` y aplica las migraciones al arrancar.

Pasos completos en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md). Contrato de la API en [`docs/API.md`](docs/API.md).
