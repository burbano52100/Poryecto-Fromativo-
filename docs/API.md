# Especificación de la API REST — GastroSENA

Contrato de endpoints del backend de GastroSENA (Express 5 + TypeScript). Todos los endpoints protegidos requieren el encabezado:
```http
Authorization: Bearer <jwt_token>
```
El rol del usuario se extrae internamente del JWT verificado. Los encabezados no confiables como `x-user-role` son ignorados.

---

## 1. Autenticación (`/api/auth`)

### `POST /api/auth/login`
- **Público**: Sí
- **Rate Limit**: Sí (10 intentos por ventana de 15 minutos)
- **Body**:
  ```json
  {
    "accountType": "aprendiz | instructor | encargado | invitado",
    "document": "1005678901",
    "password": "••••••••",
    "ficha": "2847251" // Requerido solo si accountType === 'aprendiz'
  }
  ```
- **Respuesta 200**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "document": "1005678901",
      "name": "Carlos Ruiz",
      "role": "aprendiz",
      "email": "carlos.ruiz@misena.edu.co",
      "ficha": "2847251",
      "status": "ACTIVE"
    },
    "message": "Inicio de sesión exitoso"
  }
  ```
- **Errores**: `400 Bad Request`, `401 Unauthorized` ("Credenciales inválidas").

### `POST /api/auth/register`
- **Público**: Sí
- **Restricción**: Solo se permite registrarse como `aprendiz` o `invitado`. Los intentos de auto-registro como `instructor` o `encargado` retornan `403 Forbidden`.
- **Body**:
  ```json
  {
    "name": "Pedro Pérez",
    "document": "1001234567",
    "accountType": "aprendiz | invitado",
    "ficha": "2847251", // Obligatorio para aprendiz
    "email": "pedro@misena.edu.co",
    "password": "••••••••"
  }
  ```
- **Respuesta 201**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": { ... },
    "message": "¡Registro exitoso! Cuenta creada en la base de datos."
  }
  ```
- **Errores**: `400 Bad Request`, `403 Forbidden`, `409 Conflict` ("Cédula o email ya registrado").

### `GET /api/auth/me`
- **Rol requerido**: Cualquiera autenticado
- **Respuesta 200**:
  ```json
  {
    "user": { ... },
    "activeSession": true
  }
  ```
- **Errores**: `401 Unauthorized`.

### `POST /api/auth/facial-login`
- **Restricción**: Habilitado **exclusivamente en desarrollo** (`NODE_ENV !== 'production'`). En producción responde `403 Forbidden`.
- **Body**: `{ "document": "1005678901" }`
- **Respuesta 200**: Retorna token JWT válido para el usuario encontrado.

### `GET /api/auth/users`
- **Rol requerido**: `encargado`
- **Sanitización**: Las contraseñas y hashes nunca se incluyen en la respuesta.
- **Respuesta 200**: Array de usuarios sanitizados.

---

## 2. Menú del Día (`/api/menus`)

### `GET /api/menus/activo`
- **Público/Autenticado**: Retorna el menú del día activo en servicio.
- **Respuesta 200**:
  ```json
  {
    "id": "uuid",
    "fecha": "2026-10-12",
    "nombre": "Menú Ejecutivo SENA",
    "descripcion": "Bandeja completa...",
    "precio_aprendiz": 4500,
    "precio_invitado": 8000,
    "cantidad_disponible": 150,
    "cantidad_vendida": 45,
    "estado": "activo",
    "imagen_url": "/cafeteria-bg.jpg"
  }
  ```

### `GET /api/menus`
- **Rol requerido**: `encargado`
- **Respuesta 200**: Historial de menús programados.

### `POST /api/menus`
- **Rol requerido**: `encargado`
- **Body**: Campos del menú a crear/publicar.

### `PATCH /api/menus/:id/estado`
- **Rol requerido**: `encargado`
- **Body**: `{ "estado": "activo | agotado | borrador | completado" }`

---

## 3. Ventas y Consumos (`/api/ventas` y `/api/consumos`)

### `GET /api/ventas`
- **Rol requerido**: `encargado`
- **Query Params**: `?period=dia|semana|mes`
- **Respuesta 200**: Resumen de ventas, totales acumulados y lista de transacciones.

### `GET /api/consumos`
- **Rol requerido**: `aprendiz` o `instructor`
- **Respuesta 200**: Lista de consumos del usuario autenticado (fecha, plato, valor, estado de pago).

### `POST /api/consumos/reservar`
- **Rol requerido**: `aprendiz`, `instructor`, `invitado`
- **Body**: `{ "menu_id": "uuid" }` (opcional si hay menú activo)
- **Respuesta 201**: Confirmación de reserva de almuerzo o registro en cuenta mensual.

---

## 4. Cartera de Deudas (`/api/deudas`)

### `GET /api/deudas`
- **Rol requerido**: `encargado` (listado general) o `instructor` (mi cuenta)
- **Respuesta 200**: Listado de instructores con saldos pendientes, almuerzos pendientes y días vencidos calculados en consulta.

### `POST /api/deudas/:id/pagar`
- **Rol requerido**: `encargado`
- **Body**: `{ "monto": 15000 }`
- **Respuesta 200**: Registro del pago y actualización del balance de deuda.

---

## 5. Inventario (`/api/inventario`)

### `GET /api/inventario/materiales`
- **Rol requerido**: `encargado`
- **Respuesta 200**: Lista de insumos con stock actual, stock mínimo, categoría y fecha de vencimiento.

### `POST /api/inventario/materiales`
- **Rol requerido**: `encargado`
- **Body**: Datos de nuevo material.

### `GET /api/inventario/recetas`
- **Rol requerido**: `encargado`
- **Respuesta 200**: Recetas y escandallos con ingredientes desglosados y costos.

### `GET /api/inventario/kardex`
- **Rol requerido**: `encargado`
- **Respuesta 200**: Historial de movimientos de inventario (entradas, salidas, ajustes).

### `POST /api/inventario/mermas`
- **Rol requerido**: `encargado`
- **Body**: `{ "material_id": "uuid", "cantidad_perdida": 2.5, "unidad": "Kg", "razon": "Vencimiento" }`
- **Respuesta 201**: Registro de merma con actualización automática reflejada en Kardex.

---

## 6. Grupos y Fichas (`/api/grupos`)

### `GET /api/grupos`
- **Rol requerido**: `encargado` o `instructor`
- **Respuesta 200**: Fichas SENA con programa, vocero, jornada y cantidad de aprendices.

---

## 7. Buzón de Sugerencias (`/api/sugerencias`)

### `GET /api/sugerencias`
- **Rol requerido**: Autenticado (encargado ve todas; aprendiz/instructor ven las suyas).

### `POST /api/sugerencias`
- **Rol requerido**: Autenticado. El `usuario_id` se toma directamente del token JWT.
- **Body**: `{ "asunto": "...", "mensaje": "..." }`

### `PATCH /api/sugerencias/:id/responder`
- **Rol requerido**: `encargado`
- **Body**: `{ "respuesta": "..." }`

---

## 8. Visitas Institucionales (`/api/visitas` e `/api/instituciones`)

### `GET /api/instituciones` y `POST /api/instituciones`
- **Rol requerido**: `encargado`

### `GET /api/visitas` y `GET /api/visitas/kpi`
- **Rol requerido**: `encargado`

### `POST /api/visitas`
- **Rol requerido**: `encargado`
- **Body**: Validación con Zod (institución real, precio derivado del menú activo o ingresado, validación XOR de instructor).

---

## 9. Perfil (`/api/perfil`) y Salud (`/api/health`)

### `PATCH /api/perfil`
- **Rol requerido**: Autenticado. Permite actualizar nombre y correo del usuario en sesión.

### `GET /api/health`
- **Público**: Verifica estado del servicio y conexión viva a PostgreSQL (`SELECT 1`).
- **Respuesta 200**: `{ "status": "OK", "database": "connected", "timestamp": "..." }`
