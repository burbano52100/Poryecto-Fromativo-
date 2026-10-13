-- =====================================================================
-- GASTROSENA - MIGRACIÓN INICIAL 001
-- PostgreSQL 14+
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TIPOS ENUM IDEMPOTENTES
-- ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE rol_usuario AS ENUM ('aprendiz', 'instructor', 'encargado', 'invitado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE metodo_verificacion AS ENUM ('facial', 'qr', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_menu AS ENUM ('borrador', 'activo', 'agotado', 'completado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE metodo_pago AS ENUM ('saldo', 'efectivo', 'credito', 'cortesia');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_venta AS ENUM ('completada', 'anulada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_movimiento_saldo AS ENUM ('recarga', 'consumo', 'ajuste');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_deuda AS ENUM ('pendiente', 'vencida', 'pagada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_sugerencia AS ENUM ('pendiente', 'atendida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_stock AS ENUM ('bueno', 'bajo', 'critico', 'venciendo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_movimiento_kardex AS ENUM ('entrada', 'salida', 'ajuste', 'merma');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_institucion AS ENUM ('colegio', 'universidad', 'empresa', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_visita AS ENUM ('programada', 'realizada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE metodo_pago_visita AS ENUM ('efectivo', 'transferencia', 'credito_deuda');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_pago_visita AS ENUM ('pendiente', 'pagado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- 2. TABLAS BASE: FICHAS Y USUARIOS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fichas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_ficha        TEXT NOT NULL UNIQUE,
  programa            TEXT NOT NULL,
  instructor_id       UUID,
  vocero              TEXT,
  jornada             TEXT CHECK (jornada IN ('mañana', 'tarde', 'noche')),
  cantidad_estudiantes INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                TEXT NOT NULL,
  cedula                TEXT NOT NULL UNIQUE,
  email                 TEXT UNIQUE,
  password_hash         TEXT,
  rol                   rol_usuario NOT NULL,
  ficha_id              UUID REFERENCES fichas(id) ON DELETE SET NULL,
  saldo                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_almuerzo_fijo  NUMERIC(12,2),
  codigo_qr             TEXT UNIQUE,
  foto_url              TEXT,
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vincular FK de fichas a usuarios si no existe
DO $$ BEGIN
  ALTER TABLE fichas
    ADD CONSTRAINT fichas_instructor_fk
    FOREIGN KEY (instructor_id) REFERENCES usuarios(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_ficha ON usuarios(ficha_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_cedula ON usuarios(cedula);

CREATE TABLE IF NOT EXISTS reconocimiento_facial (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modelo        TEXT NOT NULL DEFAULT 'demo',
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 3. MENÚ DEL DÍA, VENTAS Y MOVIMIENTOS DE SALDO
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS menus_dia (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha                 DATE NOT NULL,
  nombre                TEXT NOT NULL,
  descripcion           TEXT,
  precio_aprendiz       NUMERIC(12,2) NOT NULL,
  precio_invitado       NUMERIC(12,2) NOT NULL,
  cantidad_disponible   INTEGER NOT NULL DEFAULT 0,
  cantidad_vendida      INTEGER NOT NULL DEFAULT 0,
  imagen_url            TEXT,
  estado                estado_menu NOT NULL DEFAULT 'borrador',
  creado_por            UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_menus_fecha_nombre UNIQUE (fecha, nombre)
);

CREATE INDEX IF NOT EXISTS idx_menus_fecha ON menus_dia(fecha);
CREATE INDEX IF NOT EXISTS idx_menus_estado ON menus_dia(estado);

CREATE TABLE IF NOT EXISTS ventas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id            UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  menu_id               UUID NOT NULL REFERENCES menus_dia(id) ON DELETE CASCADE,
  fecha_hora            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  precio_cobrado        NUMERIC(12,2) NOT NULL,
  metodo_pago           metodo_pago NOT NULL DEFAULT 'saldo',
  metodo_verificacion   metodo_verificacion NOT NULL DEFAULT 'manual',
  registrado_por        UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  estado                estado_venta NOT NULL DEFAULT 'completada',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventas_usuario ON ventas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ventas_menu ON ventas(menu_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_hora);

CREATE TABLE IF NOT EXISTS movimientos_saldo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo              tipo_movimiento_saldo NOT NULL,
  monto             NUMERIC(12,2) NOT NULL,
  saldo_resultante  NUMERIC(12,2) NOT NULL,
  venta_id          UUID REFERENCES ventas(id) ON DELETE SET NULL,
  registrado_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_hora        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_saldo_usuario ON movimientos_saldo(usuario_id);

-- ---------------------------------------------------------------------
-- 4. CARTERA DE DEUDAS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deudas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id            UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  monto                 NUMERIC(12,2) NOT NULL,
  almuerzos_pendientes  INTEGER NOT NULL DEFAULT 0,
  fecha_origen          DATE NOT NULL DEFAULT CURRENT_DATE,
  estado                estado_deuda NOT NULL DEFAULT 'pendiente',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deudas_usuario ON deudas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_deudas_estado ON deudas(estado);

CREATE TABLE IF NOT EXISTS pagos_deuda (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deuda_id        UUID NOT NULL REFERENCES deudas(id) ON DELETE CASCADE,
  monto_pagado    NUMERIC(12,2) NOT NULL,
  fecha_pago      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pagos_deuda ON pagos_deuda(deuda_id);

-- ---------------------------------------------------------------------
-- 5. BUZÓN DE SUGERENCIAS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sugerencias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ficha_id        UUID REFERENCES fichas(id) ON DELETE SET NULL,
  asunto          TEXT NOT NULL,
  mensaje         TEXT NOT NULL,
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado          estado_sugerencia NOT NULL DEFAULT 'pendiente',
  respuesta       TEXT,
  atendida_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  atendida_en     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sugerencias_estado ON sugerencias(estado);
CREATE INDEX IF NOT EXISTS idx_sugerencias_usuario ON sugerencias(usuario_id);

-- ---------------------------------------------------------------------
-- 6. INVENTARIO, RECETAS, KARDEX Y MERMAS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categorias_material (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS materiales (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_barras       TEXT NOT NULL UNIQUE,
  nombre              TEXT NOT NULL,
  categoria_id        UUID REFERENCES categorias_material(id) ON DELETE SET NULL,
  unidad_medida       TEXT NOT NULL,
  costo_unitario      NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha_vencimiento   DATE,
  stock_actual        NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_minimo        NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materiales_categoria ON materiales(categoria_id);
CREATE INDEX IF NOT EXISTS idx_materiales_vencimiento ON materiales(fecha_vencimiento);

CREATE TABLE IF NOT EXISTS recetas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              TEXT UNIQUE,
  nombre              TEXT NOT NULL,
  costo_produccion    NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_venta        NUMERIC(12,2) NOT NULL DEFAULT 0,
  imagen_url          TEXT,
  activa              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receta_ingredientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id     UUID NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES materiales(id) ON DELETE CASCADE,
  cantidad      NUMERIC(12,3) NOT NULL,
  unidad        TEXT NOT NULL,
  costo         NUMERIC(12,2) NOT NULL,
  CONSTRAINT unq_receta_material UNIQUE (receta_id, material_id)
);

CREATE TABLE IF NOT EXISTS movimientos_kardex (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id         UUID NOT NULL REFERENCES materiales(id) ON DELETE CASCADE,
  fecha_hora          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo                tipo_movimiento_kardex NOT NULL,
  concepto            TEXT NOT NULL,
  cantidad_entrada    NUMERIC(12,3),
  cantidad_salida     NUMERIC(12,3),
  saldo_resultante    NUMERIC(12,3) NOT NULL,
  referencia_tipo     TEXT,
  referencia_id       UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kardex_material ON movimientos_kardex(material_id, fecha_hora);

CREATE TABLE IF NOT EXISTS mermas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id             UUID NOT NULL REFERENCES materiales(id) ON DELETE CASCADE,
  cantidad_perdida        NUMERIC(12,3) NOT NULL,
  unidad                  TEXT NOT NULL,
  razon                   TEXT NOT NULL,
  registrado_por          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  movimiento_kardex_id    UUID REFERENCES movimientos_kardex(id) ON DELETE SET NULL,
  fecha_hora              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor     TEXT,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compra_detalle (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id     UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES materiales(id) ON DELETE CASCADE,
  cantidad      NUMERIC(12,3) NOT NULL,
  costo_unitario NUMERIC(12,2) NOT NULL
);

-- ---------------------------------------------------------------------
-- 7. INSTITUCIONES Y VISITAS INSTITUCIONALES
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS instituciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL UNIQUE,
  tipo         tipo_institucion NOT NULL DEFAULT 'colegio',
  ciudad       TEXT NOT NULL DEFAULT 'Pitalito',
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitas_institucionales (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id          UUID NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
  instructor_id           UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre_instructor_ext   TEXT,
  cantidad_personas       INTEGER NOT NULL CHECK (cantidad_personas > 0),
  fecha_visita            DATE NOT NULL,
  precio_unitario         NUMERIC(12,2) NOT NULL,
  total_a_cobrar          NUMERIC(12,2) GENERATED ALWAYS AS (cantidad_personas * precio_unitario) STORED,
  estado                  estado_visita NOT NULL DEFAULT 'programada',
  metodo_pago             metodo_pago_visita NOT NULL DEFAULT 'efectivo',
  estado_pago             estado_pago_visita NOT NULL DEFAULT 'pendiente',
  deuda_id                UUID REFERENCES deudas(id) ON DELETE SET NULL,
  observaciones           TEXT,
  creado_por              UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE visitas_institucionales
    ADD CONSTRAINT chk_instructor_presente
    CHECK (
      (instructor_id IS NOT NULL AND nombre_instructor_ext IS NULL)
      OR
      (instructor_id IS NULL AND nombre_instructor_ext IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_visitas_institucion ON visitas_institucionales(institucion_id);
CREATE INDEX IF NOT EXISTS idx_visitas_fecha ON visitas_institucionales(fecha_visita);
CREATE INDEX IF NOT EXISTS idx_visitas_estado ON visitas_institucionales(estado);

-- ---------------------------------------------------------------------
-- 8. TRIGGER AUTOMÁTICO PARA updated_at
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_fichas_updated_at BEFORE UPDATE ON fichas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_menus_dia_updated_at BEFORE UPDATE ON menus_dia
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_deudas_updated_at BEFORE UPDATE ON deudas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_materiales_updated_at BEFORE UPDATE ON materiales
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_recetas_updated_at BEFORE UPDATE ON recetas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_instituciones_updated_at BEFORE UPDATE ON instituciones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_visitas_updated_at BEFORE UPDATE ON visitas_institucionales
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
