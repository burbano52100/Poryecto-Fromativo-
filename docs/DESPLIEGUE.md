# Guía de Despliegue — GastroSENA

Esta guía detalla los pasos para desplegar el backend en **Render** y el frontend en **GitHub Pages**, así como la configuración de variables y el bootstrap del primer encargado en producción.

---

## 1. Despliegue del Backend en Render

### 1.1 Configuración de Base de Datos PostgreSQL
1. En Render, crea una instancia de PostgreSQL mediante **New + → PostgreSQL** (o utilizando el archivo `render.yaml` como Blueprint).
2. **Consideración de límites gratuitos en Render**:
   - La base de datos gratuita de Render expira a los 30 días.
   - **Alternativas permanentes y gratuitas**: Puedes usar una base gratuita en [Neon](https://neon.tech) o [Supabase](https://supabase.com) y pegar la URL de conexión en la variable de entorno `DATABASE_URL` del servicio backend en Render.

### 1.2 Configuración del Servicio Web en Render
- **Environment**: Node
- **Root Directory**: `backend`
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `node dist/db/migrate.js && node dist/index.js`
  *(Aplica migraciones pendientes automáticamente antes de levantar el servidor Express).*

### 1.3 Variables de Entorno en Render
| Variable | Descripción | Ejemplo / Valor |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgres://user:pass@host/gastrosena` |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT (mínimo 32 caracteres) | `genera_un_string_aleatorio_seguro` |
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
3. Inicia sesión con las credenciales de tu primer encargado (`ADMIN_DOCUMENT` y `ADMIN_PASSWORD`).
4. Navega entre las pestañas y recarga la página. Gracias a `HashRouter`, la ruta se mantendrá sin arrojar 404.
