-- =====================================================================
-- GASTROSENA / SISTEMA DE ALMUERZOS SENA — ESQUEMA DE BASE DE DATOS
-- Motor objetivo: PostgreSQL 14+ (compatible con Supabase, que es lo
-- que Figma Make normalmente conecta como backend).
--
-- Convenciones:
--   * Claves primarias UUID (gen_random_uuid()) en vez de enteros
--     autoincrementales: evita colisiones si migras datos o combinas
--     entornos (dev/staging/prod) y es el estándar en Supabase.
--   * Toda tabla mutable tiene created_at / updated_at.
--   * Los estados (badges de color en la UI) se modelan como ENUM o
--     CHECK, nunca como texto libre, para que la UI y la BD no se
--     desincronicen.
--   * Nombres de tabla en plural y snake_case (estilo Postgres/Supabase).
-- =====================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. USUARIOS Y FICHAS (roles: aprendiz, instructor, encargado, invitado)
-- ---------------------------------------------------------------------

create type rol_usuario as enum ('aprendiz', 'instructor', 'encargado', 'invitado');
create type metodo_verificacion as enum ('facial', 'qr', 'manual');

-- Una "ficha" es el grupo/curso SENA (antes referenciado como "Grupo"
-- en el prototipo, con su propio programa e instructor).
create table fichas (
  id               uuid primary key default gen_random_uuid(),
  codigo_ficha     text not null unique,        -- ej. '2847251'
  programa         text not null,               -- ej. 'Técnico en Cocina'
  instructor_id    uuid references usuarios(id) deferrable initially deferred,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Nota: instructor_id se agrega con FK diferida porque usuarios.ficha_id
-- también apunta a fichas → dependencia circular. Ver ALTER al final.

create table usuarios (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  cedula                text not null unique,
  email                 text unique,
  -- NUNCA guardar contraseñas en texto plano (el prototipo actual usa
  -- localStorage, que es solo para la demo). Usar Supabase Auth o
  -- almacenar solo el hash (bcrypt/argon2) si se maneja auth propia.
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

-- Reconocimiento facial: si en algún momento se implementa de verdad
-- (no simulado como en el prototipo), separa el embedding en su propia
-- tabla en vez de meterlo en `usuarios`. Con pgvector (extensión de
-- Supabase) puedes hacer búsqueda por similitud.
-- create extension if not exists vector;
create table reconocimiento_facial (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  -- embedding       vector(128),   -- descomentar si usas pgvector
  modelo        text not null default 'demo',
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. MENÚ DEL DÍA Y VENTAS (consumo de almuerzos)
-- ---------------------------------------------------------------------

create type estado_menu as enum ('borrador', 'activo', 'agotado', 'completado');

create table menus_dia (
  id                    uuid primary key default gen_random_uuid(),
  fecha                 date not null,
  nombre                text not null,               -- 'Menú Ejecutivo', 'Menú Saludable'
  descripcion           text,
  precio_aprendiz       numeric(12,2) not null,
  precio_invitado       numeric(12,2) not null,
  cantidad_disponible   integer not null default 0,
  cantidad_vendida      integer not null default 0,
  imagen_url            text,
  estado                estado_menu not null default 'borrador',
  creado_por            uuid references usuarios(id), -- encargado que lo publicó
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (fecha, nombre)
);

create type metodo_pago as enum ('saldo', 'efectivo', 'credito', 'cortesia');
create type estado_venta as enum ('completada', 'anulada');

-- Cada almuerzo servido/consumido genera una fila aquí. Esta es a la
-- vez la tabla de "Ventas" del encargado y el "historial de fichas
-- utilizadas" que ve el aprendiz.
create table ventas (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references usuarios(id), -- quien consume
  menu_id               uuid not null references menus_dia(id),
  fecha_hora            timestamptz not null default now(),
  precio_cobrado        numeric(12,2) not null,
  metodo_pago           metodo_pago not null default 'saldo',
  metodo_verificacion   metodo_verificacion not null default 'manual',
  registrado_por        uuid references usuarios(id),          -- encargado/cajero
  estado                estado_venta not null default 'completada',
  created_at            timestamptz not null default now()
);

create index idx_ventas_usuario on ventas(usuario_id);
create index idx_ventas_menu on ventas(menu_id);
create index idx_ventas_fecha on ventas(fecha_hora);

-- Movimientos de saldo (billetera): recargas, consumos, ajustes.
-- Se recomienda esta tabla en vez de solo mutar `usuarios.saldo`, para
-- tener un rastro auditable de cada cambio (lo que la UI actual llama
-- implícitamente "Total Almuerzos Vendidos" / ingresos).
create type tipo_movimiento_saldo as enum ('recarga', 'consumo', 'ajuste');

create table movimientos_saldo (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references usuarios(id),
  tipo              tipo_movimiento_saldo not null,
  monto             numeric(12,2) not null,          -- positivo o negativo
  saldo_resultante  numeric(12,2) not null,
  venta_id          uuid references ventas(id),
  registrado_por    uuid references usuarios(id),
  fecha_hora        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. CARTERA DE DEUDAS ("Gestiona las deudas de instructores")
-- ---------------------------------------------------------------------

create type estado_deuda as enum ('pendiente', 'vencida', 'pagada');

create table deudas (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references usuarios(id),
  monto                 numeric(12,2) not null,
  almuerzos_pendientes  integer not null default 0,
  fecha_origen          date not null default current_date,
  estado                estado_deuda not null default 'pendiente',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- `dias_vencidos` que se ve en la UI es derivado, no se guarda:
--   dias_vencidos = current_date - fecha_origen (si estado = 'vencida')
-- Modélalo como columna generada o calcúlalo en la consulta:
--   select *, (current_date - fecha_origen) as dias_vencidos from deudas;

create table pagos_deuda (
  id              uuid primary key default gen_random_uuid(),
  deuda_id        uuid not null references deudas(id) on delete cascade,
  monto_pagado    numeric(12,2) not null,
  fecha_pago      timestamptz not null default now(),
  registrado_por  uuid references usuarios(id)
);

create index idx_deudas_usuario on deudas(usuario_id);
create index idx_deudas_estado on deudas(estado);

-- ---------------------------------------------------------------------
-- 4. BUZÓN DE SUGERENCIAS
-- ---------------------------------------------------------------------

create type estado_sugerencia as enum ('pendiente', 'atendida');

create table sugerencias (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid references usuarios(id),   -- null si se permite anónimo
  ficha_id        uuid references fichas(id),
  asunto          text not null,
  mensaje         text not null,
  fecha           timestamptz not null default now(),
  estado          estado_sugerencia not null default 'pendiente',
  respuesta       text,
  atendida_por    uuid references usuarios(id),
  atendida_en     timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_sugerencias_estado on sugerencias(estado);

-- ---------------------------------------------------------------------
-- 5. GASTROSENA — INVENTARIO, RECETAS, KARDEX Y MERMAS
-- ---------------------------------------------------------------------

create type estado_stock as enum ('bueno', 'bajo', 'critico', 'venciendo');

create table categorias_material (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique   -- 'Carnes y Pescados', 'Verduras', 'Granos', ...
);

create table materiales (
  id                  uuid primary key default gen_random_uuid(),
  codigo_barras       text not null unique,
  nombre              text not null,
  categoria_id        uuid references categorias_material(id),
  unidad_medida       text not null,           -- 'kg', 'L', 'unidades'
  costo_unitario      numeric(12,2) not null default 0,   -- para calcular costo de receta
  fecha_vencimiento   date,
  stock_actual        numeric(12,2) not null default 0,
  stock_minimo        numeric(12,2) not null default 0,
  activo              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- El "estado" (bueno/bajo/critico/venciendo) que muestra la UI como
-- badge es 100% derivable de stock_actual vs stock_minimo y de
-- fecha_vencimiento: mejor exponerlo como VIEW que como columna que
-- se puede desincronizar. Ejemplo:
--
-- create view materiales_con_estado as
-- select m.*,
--   case
--     when m.fecha_vencimiento is not null
--          and m.fecha_vencimiento <= current_date + interval '15 days' then 'venciendo'
--     when m.stock_actual <= m.stock_minimo * 0.5 then 'critico'
--     when m.stock_actual <= m.stock_minimo then 'bajo'
--     else 'bueno'
--   end::estado_stock as estado
-- from materiales m;

create index idx_materiales_categoria on materiales(categoria_id);
create index idx_materiales_vencimiento on materiales(fecha_vencimiento);

create table recetas (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text unique,
  nombre              text not null,             -- 'Arroz con Camarones'
  costo_produccion    numeric(12,2) not null default 0,  -- cache; recalcular desde receta_ingredientes
  precio_venta        numeric(12,2) not null default 0,
  imagen_url          text,
  activa              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Tabla puente muchos-a-muchos: qué materiales y en qué cantidad
-- componen cada receta ("Recipe Formula" en la UI).
create table receta_ingredientes (
  id            uuid primary key default gen_random_uuid(),
  receta_id     uuid not null references recetas(id) on delete cascade,
  material_id   uuid not null references materiales(id),
  cantidad      numeric(12,3) not null,
  unidad        text not null,
  costo         numeric(12,2) not null,   -- snapshot = cantidad * costo_unitario al momento de guardar
  unique (receta_id, material_id)
);

create index idx_receta_ingredientes_receta on receta_ingredientes(receta_id);
create index idx_receta_ingredientes_material on receta_ingredientes(material_id);

-- Kardex: historial de movimientos de cada material (entradas, salidas,
-- ajustes/mermas). Es la fuente de verdad para reconstruir stock_actual.
create type tipo_movimiento_kardex as enum ('entrada', 'salida', 'ajuste', 'merma');

create table movimientos_kardex (
  id                  uuid primary key default gen_random_uuid(),
  material_id         uuid not null references materiales(id),
  fecha_hora          timestamptz not null default now(),
  usuario_id          uuid references usuarios(id),   -- responsable del movimiento
  tipo                tipo_movimiento_kardex not null,
  concepto            text not null,          -- 'Compra Entrada', 'Venta Salida', 'Ajuste por Merma'
  cantidad_entrada    numeric(12,3),
  cantidad_salida     numeric(12,3),
  saldo_resultante    numeric(12,3) not null, -- balance de stock tras este movimiento
  referencia_tipo     text,                   -- 'compra' | 'receta_consumo' | 'merma' | null
  referencia_id       uuid,                   -- id de la compra/merma relacionada (sin FK fija: es polimórfico)
  created_at          timestamptz not null default now()
);

create index idx_kardex_material on movimientos_kardex(material_id, fecha_hora);
create index idx_kardex_tipo on movimientos_kardex(tipo);

-- Registro de mermas (desperdicio). Cada merma también debe generar
-- una fila espejo en movimientos_kardex (tipo='merma') para que el
-- balance de stock sea consistente; aquí se guarda el detalle humano
-- (razón) que no tiene sentido meter en el kardex genérico.
create table mermas (
  id                      uuid primary key default gen_random_uuid(),
  material_id             uuid not null references materiales(id),
  cantidad_perdida        numeric(12,3) not null,
  unidad                  text not null,
  razon                   text not null,
  registrado_por          uuid references usuarios(id),
  movimiento_kardex_id    uuid references movimientos_kardex(id),
  fecha_hora              timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

create index idx_mermas_material on mermas(material_id);

-- Opcional pero recomendado a futuro: compras/entradas de proveedor,
-- hoy solo implícitas como concepto de texto en el kardex.
create table compras (
  id            uuid primary key default gen_random_uuid(),
  proveedor     text,
  fecha         date not null default current_date,
  usuario_id    uuid references usuarios(id),
  total         numeric(12,2) not null default 0,
  created_at    timestamptz not null default now()
);

create table compra_detalle (
  id            uuid primary key default gen_random_uuid(),
  compra_id     uuid not null references compras(id) on delete cascade,
  material_id   uuid not null references materiales(id),
  cantidad      numeric(12,3) not null,
  costo_unitario numeric(12,2) not null
);

-- ---------------------------------------------------------------------
-- 6. TRIGGER GENÉRICO updated_at
-- ---------------------------------------------------------------------

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
create trigger trg_menus_dia_updated_at before update on menus_dia
  for each row execute function set_updated_at();
create trigger trg_deudas_updated_at before update on deudas
  for each row execute function set_updated_at();
create trigger trg_materiales_updated_at before update on materiales
  for each row execute function set_updated_at();
create trigger trg_recetas_updated_at before update on recetas
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 7. NOTAS DE SEGURIDAD (Supabase Row Level Security)
-- ---------------------------------------------------------------------
-- Si usas Supabase, activa RLS en TODAS las tablas y crea políticas por
-- rol, por ejemplo:
--
--   alter table usuarios enable row level security;
--   create policy "usuario ve su propio perfil"
--     on usuarios for select
--     using (auth.uid() = id or exists (
--       select 1 from usuarios u where u.id = auth.uid() and u.rol = 'encargado'
--     ));
--
-- Repite el patrón para ventas, deudas, materiales, etc.: el 'encargado'
-- ve todo, el 'aprendiz' solo sus propias ventas/saldo/sugerencias.
