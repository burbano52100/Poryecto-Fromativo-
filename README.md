# GastroSENA

Sistema de almuerzos del SENA (login por rol, gestión de visitas institucionales al comedor). Proyecto dividido en tres carpetas:

- **`frontend/`** — app React + Vite + TypeScript (login, dashboards por rol, registro de usuarios).
- **`backend/`** — API Express (datos mock en memoria por ahora, sin base de datos real conectada).
- **`database/`** — diseño y esquema de base de datos (ver `database/README.md`), pendiente de conectar al backend.

`frontend/` y `backend/` son proyectos npm **independientes**, cada uno con su propio `package.json` y `node_modules`. El `package.json` y `package-lock.json` de la raíz son un resto de una estructura anterior a la separación en carpetas; ignóralos (no tienen `workspaces` configurado y sus scripts no funcionan).

## Requisitos

- Node.js 20+

## Correrlo en local

Backend y frontend se instalan y corren por separado, en dos terminales:

```bash
# Terminal 1 — backend (http://localhost:3000)
cd backend
npm install
npm run dev
```

```bash
# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

El frontend queda en **`http://localhost:5173/Poryecto-Fromativo-/`** (con esa ruta al final — `vite.config.ts` fija `base: '/Poryecto-Fromativo-/'` para que coincida con el proyecto de GitHub Pages, así que la raíz sola `http://localhost:5173/` no sirve nada).

### Usuarios de prueba

Datos mock del backend (`backend/index.ts`), se resetean cada vez que reinicias `npm run dev` del backend:

| Rol | Documento | Contraseña | Ficha |
|---|---|---|---|
| Aprendiz | `1005678901` | `demo123` | `2847251` |
| Instructor | `1098765432` | `demo123` | — |
| Encargado | `1012345678` | `demo123` | — |

También hay un botón de reconocimiento facial (simulado) y un botón "Rellenar demo" en el formulario de login.

## Variables de entorno

Cada carpeta trae un `.env.example` como plantilla; copia a `.env` (los `.env` ya no se versionan):

- `frontend/.env` — `VITE_API_URL` (por defecto `http://localhost:3000/api`).
- `backend/.env` — `PORT` y `FRONTEND_URL` (para CORS).

Para desarrollo local no necesitas tocarlos: los valores por defecto ya apuntan entre sí correctamente.

## Otros comandos

```bash
# dentro de frontend/
npm run build     # build de producción (tsc -b && vite build)
npm run lint       # lint (oxlint)
npm run preview    # sirve el build de producción localmente

# dentro de backend/
npm run build      # compila TypeScript a backend/dist
npm run start       # corre el compilado (node dist/index.js) — usado en producción
```

## Despliegue

- **Frontend** → GitHub Pages, automático: `.github/workflows/deploy.yml` compila y publica `frontend/` en cada push a `main`.
- **Backend** → no se despliega automáticamente. `render.yaml` en la raíz permite desplegarlo en [Render](https://render.com) (plan free) con **New + → Blueprint**. Una vez desplegado, hay que:
  1. Copiar la URL pública que da Render (ej. `https://gastrosena-backend.onrender.com`).
  2. En GitHub → Settings → Secrets and variables → Actions → Variables, crear `VITE_API_URL` = `https://gastrosena-backend.onrender.com/api`.
  3. Volver a correr el workflow de deploy para que el frontend publicado use esa URL.

  Sin este paso, el sitio publicado en GitHub Pages intenta llamar a `localhost:3000` (el valor por defecto) y el login/registro falla con error de red.

- **Alternativa sin Render**: correr el backend en tu propia PC y exponerlo con un túnel (ngrok/Cloudflare Tunnel), apuntando `VITE_API_URL` a esa URL pública. Requiere tener el PC y el túnel encendidos todo el tiempo; el backend ya envía/acepta el header `ngrok-skip-browser-warning` para que funcione con ngrok gratis sin la página de aviso intermedia.

## Limitaciones conocidas

- El backend usa arreglos en memoria (`mockUsers`, `mockVisitas`, etc.) — **no hay base de datos real**, todo se pierde al reiniciar el proceso. Ver `database/README.md` para el plan de conectar una de verdad.
- El rol del usuario (`x-user-role`) se confía por header, no hay verificación de sesión real más allá de un token opaco — válido para demo/proyecto formativo, no para producción.
