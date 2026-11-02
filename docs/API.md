# Especificación de la API REST — GastroSENA

Contrato de endpoints del backend de GastroSENA (Express 5 + TypeScript). Todos los endpoints protegidos requieren el encabezado:
```http
Authorization: Bearer <jwt_token>
```
El rol del usuario se extrae internamente del JWT verificado. Los encabezados no confiables como `x-user-role` son ignorados.

**Convenciones**
- "Hoy", los períodos y el horario de reservas usan la hora de Colombia (`America/Bogota`).
- Un identificador que no es UUID responde `400` ("El identificador ... no es válido.").
- Los errores de validación Zod responden `400` con `{ message, errors }`.

---

## 1. Autenticación (`/api/auth`)

### `POST /api/auth/login`
- **Público**: Sí
- **Rate Limit**: 15 intentos por IP cada 15 minutos.
- **Body**: solo documento y contraseña. El rol **no** se envía: sale de `usuarios.rol` en la base de datos y viaja en el token y en la respuesta. Si el cliente envía `accountType` o `ficha`, se ignoran.
  ```json
  {
    "document": "1005678901",
    "password": "••••••••"
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
      "status": "ACTIVE",
      "es_beneficiario": false
    },
    "message": "Inicio de sesión exitoso"
  }
  ```
- **Errores**: `400` (faltan campos), `401` con el mensaje genérico `"Credenciales inválidas"` sea cual sea la causa (documento inexistente, contraseña incorrecta o cuenta inactiva), `429` (rate limit).

### `POST /api/auth/register`
- **Público**: Sí
- **Rate Limit**: 10 registros por IP cada hora (desactivado con `NODE_ENV=test`).
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
- **Respuesta 201**: `{ "token", "user": { ...igual que login }, "message" }`
- **Errores**: `400`, `403`, `409` ("Cédula o email ya registrado").

### `GET /api/auth/me`
- **Rol requerido**: Cualquiera autenticado
- **Respuesta 200**: `{ "user": { ...igual que login }, "activeSession": true }`
- **Errores**: `401`.

### `POST /api/auth/facial-login`
- **Restricción**: Simulación de desarrollo. Solo responde si `ENABLE_FACIAL_DEMO=true` y `NODE_ENV !== 'production'`; si no, `403`.
- **Body**: `{ "document": "1005678901" }`

### `GET /api/auth/users`
- **Rol requerido**: `encargado`
- **Respuesta 200**: Array de usuarios sin contraseñas ni hashes.

---

## 2. Menú del Día (`/api/menus`)

### `GET /api/menus/activo`
- **Público/Autenticado**: Menú activo, priorizando el de hoy. Si no hay ninguno publicado devuelve un menú por defecto con `id: "default_menu"` y `reservable: false`.
- **Respuesta 200**:
  ```json
  {
    "id": "uuid",
    "fecha": "2026-11-02",
    "nombre": "Bandeja Huilense",
    "descripcion": "Sopa, arroz, proteína, ensalada y jugo",
    "precio_aprendiz": 5000,
    "precio_invitado": 8000,
    "cantidad_disponible": 150,
    "cantidad_vendida": 45,
    "estado": "activo",
    "imagen_url": "/cafeteria-bg.jpg",
    "precio_aplicable": 0,
    "es_beneficiario": true,
    "mi_reserva": { "id": "uuid", "estado_pago": "gratis", "precio": 0 },
    "horario": { "abre": "07:00", "cierra": "21:00", "abierto": true },
    "reservable": false,
    "motivo_no_reservable": "Ya tienes tu almuerzo reservado para este menú."
  }
  ```
  `precio_aplicable` depende del usuario del token: $0 para aprendiz beneficiario, `precio_aprendiz` para aprendiz e instructor, `precio_invitado` para invitado. `mi_reserva` es `null` si el usuario no ha reservado ese menú.

### `GET /api/menus`
- **Rol requerido**: `encargado`
- **Respuesta 200**: Historial de menús.

### `POST /api/menus`
- **Rol requerido**: `encargado`
- **Body**: `{ nombre, fecha, descripcion?, precio_aprendiz, precio_invitado, cantidad_disponible, imagen_url?, estado? }`. Al publicar uno `activo`, los otros activos del mismo día pasan a `completado`.

### `PATCH /api/menus/:id/estado`
- **Rol requerido**: `encargado`
- **Body**: `{ "estado": "activo | agotado | borrador | completado" }`

---

## 3. Reservas y Consumos (`/api/consumos`)

### `POST /api/consumos/reservar`
- **Rol requerido**: `aprendiz`, `instructor` o `invitado` (el `encargado` recibe `403`).
- **Horario**: de 7:00 a. m. a 9:00 p. m. Fuera de ese horario responde `409` con `{ "fuera_de_horario": true }`.
- **Body**: `{ "menu_id": "uuid" }`. Opcional: sin `menu_id` se usa el menú activo de hoy.
- **Precio**: lo fija siempre el servidor; cualquier precio enviado por el cliente se ignora.

  | Usuario | Precio | `estado_pago` | `metodo_pago` |
  |---|---|---|---|
  | Aprendiz beneficiario | $0 | `gratis` | `cortesia` |
  | Aprendiz | `precio_aprendiz` ($5.000) | `pendiente` | `efectivo` |
  | Instructor | `precio_aprendiz`, suma a su deuda | `pendiente` | `credito` |
  | Invitado | `precio_invitado` ($8.000) | `pagado` | `efectivo` |

- **Respuesta 201**: `{ id, fecha, date, title, precio, price, paymentStatus, estado_pago, status: "RESERVED", message }`
- **Errores**: `400` (menú inválido o no activo, o no hay menú activo), `404` (menú inexistente), `409` (cupo agotado, reserva duplicada con `duplicate: true`, o fuera de horario).

### `GET /api/consumos`
- **Rol requerido**: Autenticado (historial propio).
- **Respuesta 200**:
  ```json
  [
    {
      "id": "uuid",
      "fecha": "2026-11-02T17:03:00.000Z",
      "menu_fecha": "2026-11-02",
      "date": "2 nov 2026",
      "title": "Bandeja Huilense",
      "precio": 5000,
      "price": "$5.000",
      "paymentStatus": "PAGADO | PENDIENTE | GRATIS",
      "estado_pago": "pagado | pendiente | gratis",
      "status": "RESERVED | CONSUMED"
    }
  ]
  ```
  `status` es `RESERVED` mientras el menú sea de hoy o de un día futuro, y `CONSUMED` cuando ya pasó.

### `GET /api/consumos/resumen`
- **Rol requerido**: Autenticado.
- **Respuesta 200**: `{ totalAlmuerzos, almuerzosMes, gastoMes, gastoTotal, pendientePago }`

---

## 4. Ventas (`/api/ventas`) y panel del Encargado (`/api/dashboard`)

### `GET /api/ventas?period=`
- **Rol requerido**: `encargado`
- **Query**: `period` = `Día | Semana | Mes | Trimestre | Semestre | Año` (sin importar tildes ni mayúsculas; por defecto `Semana`). Cualquier otro valor responde `400`.
- **Períodos en curso**: Día = hoy; Semana = desde el lunes; Mes = desde el día 1; Trimestre, Semestre y Año calendario.
- **Respuesta 200**:
  ```json
  {
    "period": "semana",
    "desde": "2026-11-02",
    "agrupacion": "dia | mes",
    "totales": {
      "almuerzosServidos": 120,
      "almuerzosGratis": 15,
      "ingresosCobrados": 450000,
      "porCobrar": 75000
    },
    "breakdown": [
      { "fecha": "2026-11-02", "label": "lun, 2", "count": 40, "ingresos": 150000, "percent": 100 }
    ],
    "transacciones": [
      {
        "id": "uuid", "fecha": "2026-11-02T17:03:00.000Z", "cliente": "Carlos Ruiz", "cedula": "1005678901",
        "rol": "aprendiz", "ficha": "2847251", "menu": "Bandeja Huilense", "precio": 5000,
        "estado_pago": "pendiente", "beneficiario": false
      }
    ]
  }
  ```
  - `almuerzosServidos` incluye los gratis de beneficiarios.
  - `ingresosCobrados` suma solo `estado_pago = 'pagado'`.
  - `porCobrar` suma `estado_pago = 'pendiente'`.
  - El gráfico (`breakdown`) trae un punto por día hasta Trimestre y uno por mes en Semestre y Año, incluidos los días en cero.
  - `transacciones` trae las 100 más recientes del período.

### `GET /api/dashboard/encargado`
- **Rol requerido**: `encargado`
- **Respuesta 200**:
  ```json
  {
    "ventasHoy": 42,
    "ingresosHoy": 150000,
    "porCobrarHoy": 25000,
    "deudasPendientes": { "monto": 35000, "cantidad": 3 },
    "sugerenciasPendientes": 2,
    "beneficiariosActivos": 15
  }
  ```

---

## 5. Cartera de Deudas (`/api/deudas`)

### `GET /api/deudas`
- **Rol requerido**: `encargado`
- **Respuesta 200**: `[{ id, name, type, document, debt, lunchesCount, daysOverdue, status: "ACTIVA | VENCIDA" }]`. Una deuda está vencida con más de 5 días.

### `GET /api/deudas/mi-cuenta`
- **Rol requerido**: Autenticado (pensado para instructor).
- **Respuesta 200**: `{ totalConsumed, pendingBalance, monthlyLunches, paymentMethod, paymentFrequency, nextCutoffDate }`

### `POST /api/deudas/:id/pagar`
- **Rol requerido**: `encargado`
- **Body**: `{ "monto": 5000 }`. Opcional: sin `monto` se paga el total. Un monto mayor al saldo se recorta al saldo.
- **Efecto** (en una sola transacción):
  1. Registra el pago en `pagos_deuda`.
  2. Descuenta el pago de la deuda.
  3. Marca como `pagado` las ventas pendientes **más antiguas** del instructor que el pago alcanza a cubrir. Las ventas que siguen pendientes son las más recientes cuyo total cubre el saldo restante.
  4. Al saldar la deuda, todas quedan pagadas.
- **Respuesta 200**: `{ message, saldoRestante, estado, almuerzosPagados, almuerzosPendientes }`
- **Errores**: `400` (deuda ya saldada o monto inválido), `404`.

---

## 6. Grupos y Fichas (`/api/grupos`)

### `GET /api/grupos`
- **Rol requerido**: `encargado`
- **Respuesta 200**: `[{ id, ficha, program, shift, instructor, studentsCount, reservasHoy, pendientesHoy, pagadosHoy, gratisHoy }]`. `studentsCount` cuenta los aprendices activos registrados en la ficha.

### `GET /api/grupos/mis-fichas`
- **Rol requerido**: `instructor`
- **Respuesta 200**: Fichas asignadas al instructor autenticado.

### `GET /api/grupos/:id/aprendices`
- **Rol requerido**: `encargado`
- **Respuesta 200**: `{ ficha: { id, codigo_ficha, programa }, aprendices: [{ id, name, document, email, es_beneficiario, venta_id, precio, estado_pago, payment_status, fecha_hora }] }`. Incluye solo los aprendices de la ficha que reservaron **hoy**; los instructores no aparecen.

### `PATCH /api/grupos/ventas/:ventaId/pago`
- **Rol requerido**: `encargado`
- **Body**: `{ "pagado": true | false }`
- **Errores**: `400` si la venta es gratis (beneficiario), si no es de un aprendiz (los instructores van en Cartera de Deudas) o si está anulada; `404` si no existe.

---

## 7. Beneficiarios (`/api/beneficiarios`)

Todas las rutas requieren rol `encargado`. Un beneficiario sigue siendo `rol = 'aprendiz'`; su condición es `usuarios.es_beneficiario`.

### `GET /api/beneficiarios/estudiantes`
- **Respuesta 200**: Todos los aprendices registrados: `[{ id, name, document, email, es_beneficiario, ficha, activo, created_at }]`.

### `GET /api/beneficiarios`
- **Respuesta 200**: Solo los aprendices con `es_beneficiario = true`.

### `PATCH /api/beneficiarios/:usuarioId`
- **Body**: `{ "es_beneficiario": true | false }`
- **Efecto**: El nuevo precio aplica desde la siguiente reserva; las reservas anteriores conservan su precio.
- **Respuesta 200**: `{ message, aprendiz: { id, name, document, es_beneficiario } }`
- **Errores**: `400` (body o id inválido), `404` (el usuario no existe o no es aprendiz).

---

## 8. Inventario (`/api/inventario`)

Todas las rutas requieren rol `encargado`. Cada entrada, salida o merma registra su movimiento en el Kardex.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/materiales` | Insumos con stock, stock mínimo, categoría, vencimiento y estado (`bueno`, `bajo`, `critico`, `venciendo`). |
| `POST` | `/materiales` | Crea un insumo: `{ name, code?, category, unit, expiry?, stock, stock_minimo, costo_unitario }`. |
| `PATCH` | `/materiales/:id` | Edita los datos del insumo (no el stock). |
| `DELETE` | `/materiales/:id` | Desactiva el insumo (`409` si lo usa una receta activa). |
| `POST` | `/materiales/:id/entradas` | Entrada de stock: `{ cantidad, costo_unitario?, concepto? }`. |
| `POST` | `/materiales/:id/salidas` | Salida de stock: `{ cantidad, concepto }` (concepto obligatorio). |
| `GET` | `/recetas` | Recetas con ingredientes y costo calculado. |
| `POST` | `/recetas` | Crea una receta: `{ name, code?, price, ingredients: [{ material_id, cantidad }] }`. |
| `PUT` | `/recetas/:id` | Reemplaza una receta y sus ingredientes. |
| `GET` | `/kardex` | Movimientos. Query: `desde`, `hasta`, `material_id`, `tipo`, `limit`, `offset`. |
| `GET` | `/mermas` | Historial de mermas. |
| `POST` | `/mermas` | Registra una merma y descuenta el stock: `{ material_id (o material por nombre), quantity, reason }`. |

---

## 9. Buzón de Sugerencias (`/api/sugerencias`)

### `GET /api/sugerencias`
- **Rol requerido**: Autenticado. El `encargado` ve todas; los demás roles ven solo las suyas.
- **Respuesta 200**: `[{ id, fecha, subject, message, author, role, fichaOrDoc, date, status: "PENDIENTE | ATENDIDA", respuesta }]`

### `POST /api/sugerencias`
- **Rol requerido**: Autenticado. El autor se toma del token JWT.
- **Body**: `{ "asunto": "3 a 150 caracteres", "mensaje": "10 a 2000 caracteres" }`

### `PATCH /api/sugerencias/:id/responder`
- **Rol requerido**: `encargado`
- **Body**: `{ "respuesta": "..." }` (opcional, 3 a 1000 caracteres). Marca la sugerencia como `atendida`.

---

## 10. Visitas Institucionales (`/api/visitas` e `/api/instituciones`)

### `GET /api/instituciones` y `POST /api/instituciones`
- **Rol requerido**: `encargado`

### `GET /api/visitas` y `GET /api/visitas/kpi`
- **Rol requerido**: `encargado`

### `POST /api/visitas`
- **Rol requerido**: `encargado`
- **Body**: Validación con Zod (institución real, precio derivado del menú activo o ingresado, validación XOR de instructor).

---

## 11. Perfil (`/api/perfil`) y Salud (`/api/health`)

### `PATCH /api/perfil`
- **Rol requerido**: Autenticado.
- **Body**: `{ "name"?, "email"?, "ficha"? }`. El correo institucional se guarda en `usuarios.email` (único).
- **Respuesta 200**: `{ message, user: { ...igual que login } }`
- **Errores**: `400` (correo inválido), `409` (correo en uso por otro usuario).

### `GET /api/health`
- **Público**: Verifica el servicio y la conexión a PostgreSQL (`SELECT 1`).
- **Respuesta 200**: `{ "status": "OK", "database": "connected", "timestamp": "..." }`
