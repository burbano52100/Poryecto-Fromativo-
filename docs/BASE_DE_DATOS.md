# Documentación de Base de Datos — SARA

PostgreSQL 14+ es el motor relacional exclusivo de SARA. Este documento describe el esquema, tablas principales, relaciones, enums y el procedimiento para agregar migraciones incrementales.

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
  - `rol` (`rol_usuario`: `'aprendiz'`, `'instructor'`, `'encargado'`). El valor `'invitado'` se eliminó en la migración 006 (ADR 016).
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
  - `precio_aprendiz` (NUMERIC(12,2), NOT NULL) — único precio del menú (la columna `precio_invitado` se eliminó en la migración 006)
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
  - `institucion_nombre` (TEXT, NOT NULL, CHECK no vacío y máximo 150) — escrito a mano por el encargado (migración 008)
  - `responsable_nombre` (TEXT, NOT NULL, CHECK no vacío y máximo 150) — escrito a mano por el encargado (migración 008)
  - `institucion_id` (UUID, FK -> `instituciones(id)` ON DELETE SET NULL), `instructor_id` (UUID, FK -> `usuarios(id)`) y `nombre_instructor_ext` (TEXT) — historial de las visitas anteriores a la 008; opcionales y sin uso en la aplicación
  - `cantidad_personas` (INTEGER, CHECK > 0)
  - `fecha_visita` (DATE, NOT NULL)
  - `precio_unitario` (NUMERIC(12,2), NOT NULL)
  - `total_a_cobrar` (GENERATED ALWAYS AS (cantidad_personas * precio_unitario) STORED)
  - `estado` (`estado_visita`: `'programada'`, `'realizada'`, `'cancelada'`)
  - `metodo_pago` (`metodo_pago_visita`: `'efectivo'`, `'transferencia'`, `'credito_deuda'`)
  - `estado_pago` (`estado_pago_visita`: `'pendiente'`, `'pagado'`)
  - La restricción XOR `chk_instructor_presente` se eliminó en la migración 008.
  - Si el encargado no envía `precio_unitario`, el backend usa la tarifa de almuerzo invitado `corriente`.

### 2.7 Almuerzos Invitados (migración 007, ADR 016)
- **`almuerzos_invitados`**: almuerzos vendidos a invitados, registrados por el encargado por número de personas.
  - `id` (UUID, PK)
  - `tipo` (`tipo_almuerzo_invitado`: `'instructor'`, `'aprendiz'`, `'corriente'`)
  - `cantidad` (INTEGER, NOT NULL, CHECK > 0) — número de personas
  - `precio_unitario` (NUMERIC(12,2), NOT NULL, CHECK >= 0) — tarifa vigente al registrar; no cambia si después cambian las tarifas
  - `total` (GENERATED ALWAYS AS (cantidad * precio_unitario) STORED)
  - `nombre_invitado` (TEXT, NULL) — nombre o nota del grupo
  - `registrado_por` (UUID, NOT NULL, FK -> `usuarios(id)`) — encargado que lo registró
  - `fecha_hora` (TIMESTAMPTZ, DEFAULT NOW()), `created_at`, `updated_at` (trigger `trg_almuerzos_invitados_updated_at`)
  - Índices: `idx_almuerzos_invitados_fecha (fecha_hora)`, `idx_almuerzos_invitados_tipo_fecha (tipo, fecha_hora)`, `idx_almuerzos_invitados_registrado_por (registrado_por)`.
  - Las tarifas vigentes (instructor $10.000, aprendiz $5.000, corriente $11.000) y el máximo de 500 personas por registro están en un solo lugar: `backend/src/config/almuerzosInvitados.ts`.
  - Al leer con `pg`, `precio_unitario` y `total` se convierten con `::float8` para que lleguen como número.

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

### Migraciones 006 y 007 (ADR 016)
- `006_eliminar_perfil_invitado.sql`: borra los usuarios con rol `invitado` y sus datos (ventas, deudas, movimientos y sugerencias; antes devuelve al menú las porciones que habían reservado), recrea el enum `rol_usuario` sin `'invitado'` (cambia `usuarios.rol` y `solicitudes_cuenta.rol` y recrea su CHECK) y elimina `menus_dia.precio_invitado`. No toca las demás tablas.
- `007_almuerzos_invitados.sql`: crea el enum `tipo_almuerzo_invitado`, la tabla `almuerzos_invitados`, sus índices y su trigger.
- Las dos son idempotentes. Se aplican con `cd backend && npm run migrate:dev` o, a mano con psql, con `database/migracion_almuerzos_invitados.sql` (incluye los mismos archivos y los registra en `schema_migrations`).

### Migración 008: visitas con institución y responsable en texto
- `008_visitas_nombres_texto.sql` agrega `institucion_nombre` y `responsable_nombre`, copia los nombres de las visitas que ya existían (la institución desde `instituciones` y el responsable desde el instructor o `nombre_instructor_ext`, sin el sufijo "(Instructor SENA)" del instructor demo) y los deja obligatorios con máximo 150 caracteres.
- `institucion_id` deja de ser obligatoria, se elimina `chk_instructor_presente` y la FK a `instituciones` pasa de `ON DELETE CASCADE` a `ON DELETE SET NULL`: borrar una institución ya no borra visitas.
- Es idempotente y no borra datos. Se aplica con `cd backend && npm run migrate:dev`.
