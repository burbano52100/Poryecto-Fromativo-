# Base de datos

Esta carpeta reúne todo lo relacionado al modelo de datos de GastroSENA.
Ahora mismo el `backend/` **no está conectado a ninguna base de datos real**:
usa un arreglo en memoria (`mockUsers` en `backend/index.ts`) solo para la demo.
Los archivos de aquí son el diseño de referencia para cuando se conecte una
base de datos de verdad.

## Contenido

- `gastrosena_diseno_bd.md` — documento de diseño (entidades, relaciones, decisiones).
- `gastrosena_schema.sql` — esquema completo en PostgreSQL (tablas, enums, índices, triggers).
- `create_tables.py`, `database.py`, `models.py` — prototipo alternativo con SQLAlchemy
  apuntando a MySQL. **Inconsistente con `gastrosena_schema.sql` (Postgres)** — quedó
  de una exploración previa; antes de usarlo hay que decidir un solo motor de base de datos.

## Cómo conectar una base de datos real

1. Elegir motor (PostgreSQL es el que tiene el esquema más completo en `gastrosena_schema.sql`).
2. Levantar la base (local o en un servidor) y correr `gastrosena_schema.sql`.
3. En `backend/`, reemplazar el arreglo `mockUsers` de `index.ts` por consultas reales
   (por ejemplo con `pg` o un ORM), usando variables de entorno en `backend/.env`
   para la cadena de conexión.
