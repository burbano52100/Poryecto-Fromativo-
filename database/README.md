# Base de datos GastroSENA

Esta carpeta reúne la documentación y el diseño relacional del modelo de datos de GastroSENA.

## Motor de Base de Datos

El único motor oficial del proyecto es **PostgreSQL 14+**, instalado localmente para desarrollo (sin Docker) y Render PostgreSQL en producción.

> **Nota de arquitectura:**
> Las migraciones canónicas y ejecutables residen en **`backend/src/db/migrations/`** (archivos numerados `001_initial_schema.sql`, etc.), y se ejecutan automáticamente a través del runner `backend/src/db/migrate.ts` (`npm run migrate`).
>
> Los prototipos previos en MySQL/SQLAlchemy (`database.py`, `models.py`, `create_tables.py`) fueron eliminados para mantener consistencia estricta en un solo motor relacional.

## Archivos de esta carpeta

- `gastrosena_diseno_bd.md` — Documento de arquitectura, modelo relacional y decisiones de dominio (entidades, atributos, decisiones clave).
- `gastrosena_schema.sql` — Copia de referencia del esquema en PostgreSQL (sin perfil invitado y con `almuerzos_invitados`).
- `migracion_almuerzos_invitados.sql` — Aplica a mano con `psql` las migraciones 006 (elimina el perfil invitado) y 007 (crea `almuerzos_invitados`). No copia el SQL: incluye los archivos de `backend/src/db/migrations/` y los registra en `schema_migrations`, así el runner no los repite.

```bash
# Desde la raíz del repositorio (la vía normal sigue siendo: cd backend && npm run migrate:dev)
psql "postgresql://postgres:CLAVE@localhost:5432/gastrosena" -f database/migracion_almuerzos_invitados.sql
```

Los datos de demostración (seed) están en `backend/src/db/seed.ts` y se cargan con `cd backend && npm run seed:dev`.

Para consultar el diccionario de datos completo y cómo agregar nuevas migraciones, ver [`docs/BASE_DE_DATOS.md`](../docs/BASE_DE_DATOS.md).
