# Base de datos GastroSENA

Esta carpeta reúne la documentación y el diseño relacional del modelo de datos de GastroSENA.

## Motor de Base de Datos

El único motor oficial del proyecto es **PostgreSQL 14+** (compatible con Docker, Render PostgreSQL, Supabase y Neon).

> **Nota de arquitectura:**
> Las migraciones canónicas y ejecutables residen en **`backend/src/db/migrations/`** (archivos numerados `001_initial_schema.sql`, etc.), y se ejecutan automáticamente a través del runner `backend/src/db/migrate.ts` (`npm run migrate`).
>
> Los prototipos previos en MySQL/SQLAlchemy (`database.py`, `models.py`, `create_tables.py`) fueron eliminados para mantener consistencia estricta en un solo motor relacional.

## Archivos de esta carpeta

- `gastrosena_diseno_bd.md` — Documento de arquitectura, modelo relacional y decisiones de dominio (entidades, atributos, decisiones clave).
- `gastrosena_schema.sql` — Copia de referencia del esquema inicial en PostgreSQL.

Para consultar el diccionario de datos completo y cómo agregar nuevas migraciones, ver [`docs/BASE_DE_DATOS.md`](../docs/BASE_DE_DATOS.md).
