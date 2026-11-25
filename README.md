# SARA

**SARA** (Sistema Automatizado de Solicitud de Almuerzos, antes GastroSENA) es el sistema web para reservar almuerzos en el SENA (Tecnoparque Yamboró, Pitalito, Huila). Proyecto formativo ADSO.

- **`frontend/`**: React 19 + TypeScript + Vite, Tailwind CSS 4, React Query, React Hook Form + Zod. Atomic design.
- **`backend/`**: API Express 5 + TypeScript sobre **PostgreSQL**, con migraciones versionadas.
- **`database/`**: diseño del modelo de datos (`database/README.md`).
- **`docs/`**: API, base de datos, decisiones, despliegue, progreso y pendientes.

`frontend/` y `backend/` son proyectos npm **independientes**. El `package.json` de la raíz es un resto de una estructura anterior; ignóralo.

## Roles

| Rol | Qué hace |
|---|---|
| Aprendiz | Reserva su almuerzo ($5.000; $0 si es beneficiario, con un clic) y lo paga con el código QR subiendo la captura del comprobante; ve sus fichas y si están pagadas, usa el buzón. |
| Instructor | Reserva a su precio y lo paga con el código QR, igual que el aprendiz. Lo que fió antes del QR sigue en la Cartera de Deudas y lo ve en Mi Cuenta. |
| Encargado | Ventas, pagos con QR (revisa los comprobantes que el lector no pudo confirmar), menú del día, almuerzos invitados y especiales, beneficiarios, cartera, inventario, grupos y buzón. |

No hay perfil de invitado: los almuerzos de personas externas los registra el encargado en **Almuerzos Invitados**, por número de personas y con tarifa fija por tipo (instructores $10.000, aprendices $5.000, corrientes $11.000). Esos ingresos se suman en Ventas (ADR 016).

**Pago con QR (ADR 027)**: al solicitar el almuerzo se aparta la porción 15 minutos y se abre un chat con el código QR de Bancolombia. La persona paga desde la app de su banco y sube la captura: el backend la lee con OCR (Tesseract, gratis) y revisa que sea de hoy, por el valor del almuerzo, a la hora de la reserva y que ese comprobante no se haya usado antes. Lo que no puede confirmar lo revisa el encargado.

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
   npm run db:init           # aplica las migraciones y crea el primer encargado (ADMIN_*) y el primer coordinador (COORDINADOR_*)
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
| Coordinador | `1023456789` |
| Encargado | `1012345678` |
| Instructor | `1098765432` |
| Aprendiz | `1005678901` |

Además, `1005678920` es una aprendiz creada por carga masiva: entra con su documento como contraseña y debe cambiarla al ingresar.

El seed no corre en producción salvo que `SEED_DEMO=true`.

Las cuentas nuevas de **aprendiz** e **instructor** se piden desde "Registrarse" y quedan pendientes hasta que el **Coordinador** las apruebe en **Solicitudes de Cuenta** (ADR 018). Encargados y coordinadores no se registran solos: el primero de cada rol lo crea el backend al migrar, con las variables `ADMIN_*` y `COORDINADOR_*`.

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
