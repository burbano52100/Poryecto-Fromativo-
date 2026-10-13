# Documentación de Base de Datos — GastroSENA

PostgreSQL 14+ es el motor relacional exclusivo de GastroSENA. Este documento describe el esquema, tablas principales, relaciones, enums y el procedimiento para agregar migraciones incrementales.

---

## 1. Convenciones del Esquema

- **Llaves primarias**: `UUID` con `gen_random_uuid()` para evitar identificadores secuenciales predecibles.
- **Trazabilidad**: Columnas `created_at` y `updated_at` (con triggers automáticos) en tablas mutables.
- **Moneda**: Columnas numéricas monetarias definidas como `NUMERIC(12,2)`.
- **Estados**: Definidos como tipos `ENUM` de Postgres para asegurar integridad a nivel de base de datos.
- **Idempotencia**: Creación de tipos envuelta en bloques `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null; END $$;`.

---

## 2. Diccionario de Datos

### 2.1 Usuarios y Fichas
- **`usuarios`**:
  - `id` (UUID, PK)
  - `nombre` (TEXT, NOT NULL)
  - `cedula` (TEXT, NOT NULL, UNIQUE)
  - `email` (TEXT, UNIQUE)
  - `password_hash` (TEXT, NULL) — hash generado con bcrypt (10 rondas)
  - `rol` (`rol_usuario`: `'aprendiz'`, `'instructor'`, `'encargado'`, `'invitado'`)
  - `ficha_id` (UUID, FK -> `fichas(id)`)
  - `saldo` (NUMERIC(12,2), DEFAULT 0)
  - `precio_almuerzo_fijo` (NUMERIC(12,2), NULL)
  - `codigo_qr` (TEXT, UNIQUE)
  - `foto_url` (TEXT)
  - `activo` (BOOLEAN, DEFAULT TRUE)
- **`fichas`**:
  - `id` (UUID, PK)
  - `codigo_ficha` (TEXT, NOT NULL, UNIQUE, ej. `'2847251'`)
  - `programa` (TEXT, NOT NULL, ej. `'Análisis y Desarrollo de Software'`)
  - `instructor_id` (UUID, FK -> `usuarios(id)`)
  - `vocero` (TEXT)
  - `jornada` (TEXT, CHECK in `'mañana'`, `'tarde'`, `'noche'`)
  - `cantidad_estudiantes` (INTEGER, DEFAULT 0)

### 2.2 Menús, Ventas y Movimientos de Saldo
- **`menus_dia`**:
  - `id` (UUID, PK)
  - `fecha` (DATE, NOT NULL)
  - `nombre` (TEXT, NOT NULL)
  - `descripcion` (TEXT)
  - `precio_aprendiz` (NUMERIC(12,2), NOT NULL)
  - `precio_invitado` (NUMERIC(12,2), NOT NULL)
  - `cantidad_disponible` (INTEGER, DEFAULT 0)
  - `cantidad_vendida` (INTEGER, DEFAULT 0)
  - `imagen_url` (TEXT)
  - `estado` (`estado_menu`: `'borrador'`, `'activo'`, `'agotado'`, `'completado'`)
  - `creado_por` (UUID, FK -> `usuarios(id)`)
  - Restricción: `UNIQUE(fecha, nombre)`
- **`ventas`** (Consumos de almuerzos):
  - `id` (UUID, PK)
  - `usuario_id` (UUID, NOT NULL, FK -> `usuarios(id)`)
  - `menu_id` (UUID, NOT NULL, FK -> `menus_dia(id)`)
  - `fecha_hora` (TIMESTAMPTZ, DEFAULT NOW())
  - `precio_cobrado` (NUMERIC(12,2), NOT NULL)
  - `metodo_pago` (`metodo_pago`: `'saldo'`, `'efectivo'`, `'credito'`, `'cortesia'`)
  - `metodo_verificacion` (`metodo_verificacion`: `'facial'`, `'qr'`, `'manual'`)
  - `registrado_por` (UUID, FK -> `usuarios(id)`)
  - `estado` (`estado_venta`: `'completada'`, `'anulada'`)
- **`movimientos_saldo`**: Bitácora de transacciones de billetera (`tipo`: `'recarga'`, `'consumo'`, `'ajuste'`).

### 2.3 Cartera de Deudas
- **`deudas`**:
  - `id` (UUID, PK)
  - `usuario_id` (UUID, NOT NULL, FK -> `usuarios(id)`)
  - `monto` (NUMERIC(12,2), NOT NULL)
  - `almuerzos_pendientes` (INTEGER, DEFAULT 0)
  - `fecha_origen` (DATE, DEFAULT CURRENT_DATE)
  - `estado` (`estado_deuda`: `'pendiente'`, `'vencida'`, `'pagada'`)
- **`pagos_deuda`**:
  - `id` (UUID, PK)
  - `deuda_id` (UUID, FK -> `deudas(id)`)
  - `monto_pagado` (NUMERIC(12,2), NOT NULL)
  - `fecha_pago` (TIMESTAMPTZ, DEFAULT NOW())
  - `registrado_por` (UUID, FK -> `usuarios(id)`)

### 2.4 Buzón de Sugerencias
- **`sugerencias`**:
  - `id` (UUID, PK)
  - `usuario_id` (UUID, FK -> `usuarios(id)`)
  - `ficha_id` (UUID, FK -> `fichas(id)`)
  - `asunto` (TEXT, NOT NULL)
  - `mensaje` (TEXT, NOT NULL)
  - `fecha` (TIMESTAMPTZ, DEFAULT NOW())
  - `estado` (`estado_sugerencia`: `'pendiente'`, `'atendida'`)
  - `respuesta` (TEXT)
  - `atendida_por` (UUID, FK -> `usuarios(id)`)
  - `atendida_en` (TIMESTAMPTZ)

### 2.5 Inventario, Recetas, Kardex y Mermas
- **`categorias_material`**: `id` (UUID, PK), `nombre` (TEXT, UNIQUE).
- **`materiales`**: `id`, `codigo_barras` (UNIQUE), `nombre`, `categoria_id`, `unidad_medida`, `costo_unitario`, `fecha_vencimiento`, `stock_actual`, `stock_minimo`, `activo`.
- **`recetas`**: `id`, `codigo` (UNIQUE), `nombre`, `costo_produccion`, `precio_venta`, `imagen_url`, `activa`.
- **`receta_ingredientes`**: `id`, `receta_id`, `material_id`, `cantidad`, `unidad`, `costo`.
- **`movimientos_kardex`**: `id`, `material_id`, `fecha_hora`, `usuario_id`, `tipo` (`'entrada'`, `'salida'`, `'ajuste'`, `'merma'`), `concepto`, `cantidad_entrada`, `cantidad_salida`, `saldo_resultante`.
- **`mermas`**: `id`, `material_id`, `cantidad_perdida`, `unidad`, `razon`, `registrado_por`, `movimiento_kardex_id`, `fecha_hora`.

### 2.6 Instituciones y Visitas Institucionales
- **`instituciones`**: `id`, `nombre` (UNIQUE), `tipo` (`'colegio'`, `'universidad'`, `'empresa'`, `'otro'`), `ciudad`, `activo`.
- **`visitas_institucionales`**:
  - `id` (UUID, PK)
  - `institucion_id` (UUID, FK -> `instituciones(id)`)
  - `instructor_id` (UUID, FK -> `usuarios(id)`) — opcional si es interno
  - `nombre_instructor_ext` (TEXT) — opcional si es externo
  - `cantidad_personas` (INTEGER, CHECK > 0)
  - `fecha_visita` (DATE, NOT NULL)
  - `precio_unitario` (NUMERIC(12,2), NOT NULL)
  - `total_a_cobrar` (GENERATED ALWAYS AS (cantidad_personas * precio_unitario) STORED)
  - `estado` (`estado_visita`: `'programada'`, `'realizada'`, `'cancelada'`)
  - `metodo_pago` (`metodo_pago_visita`: `'efectivo'`, `'transferencia'`, `'credito_deuda'`)
  - `estado_pago` (`estado_pago_visita`: `'pendiente'`, `'pagado'`)
  - Restricción XOR `chk_instructor_presente`: Requiere exactamente uno de `instructor_id` o `nombre_instructor_ext`.

---

## 3. Control de Migraciones (`schema_migrations`)

La base de datos cuenta con una tabla de auditoría de esquema:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Cómo agregar una migración nueva
1. Crear un archivo en `backend/src/db/migrations/` siguiendo la convención de prefijo incremental:
   - Ejemplo: `002_agregar_columna_telefono.sql`
2. Escribir sentencias SQL DDL compatibles y seguras.
3. Al compilar el backend (`npm run build`), el script `bundle-migrations` registrará el archivo en `migrationsMap.ts`.
4. Al arrancar el servicio (`npm run migrate`), el runner detectará que la versión `002_agregar_columna_telefono.sql` aún no existe en `schema_migrations`, la ejecutará dentro de una transacción y la registrará.
