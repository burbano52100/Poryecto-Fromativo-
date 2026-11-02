# Guía de Despliegue — GastroSENA

Esta guía detalla los pasos para desplegar el backend en **Render** y el frontend en **GitHub Pages**, así como la configuración de variables y el bootstrap del primer encargado en producción.

---

## 1. Despliegue del Backend en Render

### 1.1 Blueprint (`render.yaml`)
La forma recomendada es **New + → Blueprint** apuntando a este repositorio. El archivo `render.yaml` de la raíz:
- Crea la base de datos `gastrosena-db` (PostgreSQL, plan free).
- Conecta `DATABASE_URL` del servicio con `fromDatabase` (`name: gastrosena-db`, `property: connectionString`).
- Genera `JWT_SECRET` automáticamente (`generateValue: true`).
- Pide en el panel `ADMIN_DOCUMENT`, `ADMIN_PASSWORD` y `ADMIN_EMAIL` (`sync: false`), que nunca se versionan.

> La base de datos gratuita de Render expira a los 30 días. Como alternativa permanente se puede usar Neon o Supabase: en ese caso se reemplaza `DATABASE_URL` por la URL externa en el panel de Render.

### 1.2 Servicio Web
- **Runtime**: Node
- **Root Directory**: `backend`
- **Build Command**: `npm ci --include=dev && npm run build`
  *(`--include=dev` es necesario: con `NODE_ENV=production`, npm omitiría `typescript` y `tsx`, que el build usa).*
- **Start Command**: `npm run migrate && npm run start`
  *(El plan gratuito no tiene pre-deploy: las migraciones, que son idempotentes, se aplican en cada arranque y luego se levanta Express).*
- **Health Check Path**: `/api/health`

### 1.3 Variables de Entorno en Render
| Variable | Descripción | Ejemplo / Valor |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgres://user:pass@host/gastrosena` |
| `JWT_SECRET` | Clave para firmar los JWT (Render la genera con el Blueprint) | `generateValue: true` |
| `FRONTEND_URL` | URL pública de tu frontend en GitHub Pages | `https://burbano52100.github.io` |
| `PORT` | Puerto HTTP (Render lo asigna en 10000) | `10000` |
| `NODE_ENV` | Modo de entorno | `production` |
| `ADMIN_DOCUMENT` | Cédula del primer encargado (Bootstrap) | `1012345678` |
| `ADMIN_PASSWORD` | Contraseña del primer encargado | `TuClaveSegura2026!` |
| `ADMIN_NAME` | Nombre del primer encargado (Opcional) | `Administrador General Comedor` |
| `ADMIN_EMAIL` | Correo del primer encargado (Opcional) | `admin@sena.edu.co` |

> **Nota sobre el Bootstrap del Encargado**:
> Al iniciar por primera vez, el backend detecta si la base no tiene encargados registrados. Si `ADMIN_DOCUMENT` y `ADMIN_PASSWORD` están definidos, crea de inmediato al usuario encargado con su contraseña hasheada. No necesitas activar el seed demo en producción.

---

## 2. Despliegue del Frontend en GitHub Pages

El frontend se despliega automáticamente en cada `push` a la rama `main` a través del workflow `.github/workflows/deploy.yml`.

### 2.1 Configuración de `VITE_API_URL` en GitHub Actions
> **IMPORTANTE**:
> `deploy.yml` lee la variable mediante `${{ vars.VITE_API_URL }}`.
> Debe crearse como **Variable**, **NO como Secreto**:
>
> 1. Ve a tu repositorio en GitHub.
> 2. Entra en **Settings** → **Secrets and variables** → **Actions** → pestaña **Variables**.
> 3. Clic en **New repository variable**.
> 4. Name: `VITE_API_URL`
> 5. Value: la URL pública de tu backend en Render con `/api` al final (por ejemplo: `https://gastrosena-backend.onrender.com/api`).
> 6. Guarda la variable.
> 7. Ve a la pestaña **Actions** de GitHub y ejecuta nuevamente el workflow **Deploy frontend to GitHub Pages** (Run workflow) para que el build compile con la URL de producción.

---

## 3. Verificación Post-Despliegue

1. Abre la URL de salud del backend: `https://gastrosena-backend.onrender.com/api/health`. Deberías recibir:
   ```json
   { "status": "OK", "database": "connected", "system": "GastroSENA API" }
   ```
2. Abre la URL de GitHub Pages (ej. `https://burbano52100.github.io/Poryecto-Fromativo-/#/login`).
3. Inicia sesión solo con documento y contraseña del primer encargado (`ADMIN_DOCUMENT` y `ADMIN_PASSWORD`); la app abre `#/encargado/inicio`.
4. Navega entre las pestañas y recarga la página. Gracias a `HashRouter`, la ruta se mantendrá sin arrojar 404.

---

## 4. Integración continua

`.github/workflows/ci.yml` corre en cada push a `main` y en cada pull request:
- **Backend:** `npm ci`, `npm run lint`, `npm run build` y `npm test` contra un servicio `postgres:16` (`DATABASE_URL_TEST` apunta a `gastrosena_test`).
- **Frontend:** `npm ci`, `npm run lint`, `npm run build` y `npm test`.
