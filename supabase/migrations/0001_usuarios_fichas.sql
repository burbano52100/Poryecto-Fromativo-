-- =====================================================================
-- 0001 — USUARIOS Y FICHAS
-- Fuente: gastrosena_diseno_bd.md (sección 3) / gastrosena_schema.sql (sección 1)
-- =====================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

create type rol_usuario as enum ('aprendiz', 'instructor', 'encargado', 'invitado');
create type metodo_verificacion as enum ('facial', 'qr', 'manual');

-- `instructor_id` se declara sin `references` inline: `usuarios` todavía no
-- existe en este punto del script. La FK real se agrega más abajo con ALTER,
-- una vez que `usuarios` ya fue creada (dependencia circular fichas <-> usuarios).
create table fichas (
  id               uuid primary key default gen_random_uuid(),
  codigo_ficha     text not null unique,        -- ej. '2847251'
  programa         text not null,               -- ej. 'Técnico en Cocina'
  instructor_id    uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table usuarios (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  cedula                text not null unique,
  email                 text unique,
  -- NUNCA guardar contraseñas en texto plano en producción. El prototipo
  -- (antes en localStorage, ahora aquí) sigue sin hashear como atajo temporal
  -- de demo — ver advertencia de seguridad en el resumen de esta migración.
  password_hash         text,
  rol                   rol_usuario not null,
  ficha_id              uuid references fichas(id),      -- solo aplica a 'aprendiz'
  saldo                 numeric(12,2) not null default 0,
  precio_almuerzo_fijo  numeric(12,2),                    -- override opcional por usuario
  codigo_qr             text unique,                      -- identificación rápida en el punto de venta
  foto_url              text,                             -- foto de referencia p/ reconocimiento facial
  activo                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table fichas
  add constraint fichas_instructor_fk
  foreign key (instructor_id) references usuarios(id);

create index idx_usuarios_rol on usuarios(rol);
create index idx_usuarios_ficha on usuarios(ficha_id);
create index idx_usuarios_cedula on usuarios(cedula);

-- Reconocimiento facial: separado de `usuarios` a propósito (ver diseño).
-- create extension if not exists vector; -- descomentar si se usa pgvector
create table reconocimiento_facial (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  -- embedding       vector(128),   -- descomentar si usas pgvector
  modelo        text not null default 'demo',
  creado_en     timestamptz not null default now()
);

-- Trigger genérico updated_at (se reutiliza en las próximas migraciones)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_usuarios_updated_at before update on usuarios
  for each row execute function set_updated_at();
create trigger trg_fichas_updated_at before update on fichas
  for each row execute function set_updated_at();
