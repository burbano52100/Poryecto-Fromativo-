# GastroSENA

Proyecto dividido en tres carpetas para moverse más fácil entre partes:

- **`frontend/`** — app React + Vite + TypeScript (login, UI).
- **`backend/`** — API Express (datos mock en memoria por ahora, sin base de datos real conectada).
- **`database/`** — diseño y esquema de la base de datos (ver `database/README.md`), pendiente de conectar al backend.

## Requisitos

- Node.js 20+
- npm 10+ (el proyecto usa [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces): un solo `node_modules` en la raíz para las tres carpetas del código)

## Instalación

Desde la raíz del proyecto:

```bash
npm install
```

## Desarrollo

```bash
npm run dev:all   # levanta frontend (http://localhost:5173) y backend (http://localhost:3000) juntos
```

O por separado, en dos terminales:

```bash
npm run dev       # solo frontend
npm run server    # solo backend
```

## Otros comandos

```bash
npm run build   # build de producción del frontend
npm run lint    # lint del frontend (oxlint)
```

## Variables de entorno

- `frontend/.env` — `VITE_API_URL` (por defecto `http://localhost:3000/api`).
- `backend/.env` — `PORT` y `FRONTEND_URL` (para CORS).

Ninguna contiene datos sensibles; ambas están versionadas como ejemplo de configuración local.
