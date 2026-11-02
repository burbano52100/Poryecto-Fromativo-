# Paso 5 – Módulo de Beneficiarios (Frontend)

Este documento describe la especificación de negocio, el diseño visual, la arquitectura de componentes y los contratos de integración para el **Módulo de Beneficiarios** en el frontend de GastroSENA.

---

## 🎯 1. Objetivo del Módulo

Administrar el programa de subsidio escolar que otorga alimentación al **100% de subsidio (precio $0 COP)** a aprendices focalizados del SENA. El módulo permite:
1. Al **Encargado**: Visualizar aprendices registrados, asignarles el beneficio y revocarlo mediante un modal de confirmación transparente.
2. Al **Aprendiz Beneficiario**: Reservar su almuerzo a $0 con **un solo clic**, sin pantallas de pago ni fricciones, manteniendo su perfil estándar de Aprendiz.

---

## 💼 2. Reglas de Negocio Clave

1. **El precio $0 lo fija exclusivamente el backend:**  
   El frontend **nunca** calcula ni envía un valor monetario en la solicitud de reserva. El servidor inspecciona la condición `usuarios.es_beneficiario` en la base de datos:
   - Si es beneficiario $\rightarrow$ asigna `precio_cobrado = 0`, `metodo_pago = 'cortesia'` y `estado_pago = 'gratis'`.
   - Si no es beneficiario $\rightarrow$ asigna la tarifa regular de `$5.000 COP`.
   El frontend únicamente refleja este estado en la interfaz para proveer retroalimentación visual al usuario.
2. **Sin roles separados:**  
   Los beneficiarios **no tienen un rol nuevo** en el sistema (`rol = 'aprendiz'`); su condición es un atributo booleano (`es_beneficiario`).
3. **Persistencia histórica:**  
   Si el Encargado retira el beneficio a un aprendiz, su precio vuelve a ser de **$5.000 COP a partir de su siguiente reserva**. Los consumos y reservas ya registrados a $0 conservan su valor histórico en el historial.

---

## 🖥️ 3. Interfaz del Encargado

- **Sidebar institucional:**
  - Ítem **"Beneficiarios"** con acento ámbar institucional (`roleVariant="encargado"`, icono `Award`).
  - Ubicado entre *Menú del Día* y *Cartera de Deudas*.

- **Componente `BeneficiariosSection.tsx`:**
  - **Tarjetas de Estadísticas:**
    - Beneficiarios Activos (contador en tiempo real).
    - Total de Aprendices Registrados en el sistema.
    - Tarifa de Subsidio ($0 COP - 100% Gratis).
  - **Pestaña 1: "Todos los estudiantes registrados":**
    - Muestra a todos los aprendices del sistema.
    - Buscador reactivo por nombre, número de cédula o código de ficha.
    - Menú desplegable para filtrar por Ficha SENA.
    - Distintivo visual del estado actual (`Beneficiario ($0)` vs `Tarifa Regular ($5.000)`).
    - Botón **"Agregar como beneficiario"** con confirmación reactiva.
  - **Pestaña 2: "Beneficiarios actuales":**
    - Filtra exclusivamente a los estudiantes que tienen el beneficio activo.
    - Botón **"Quitar"** en color rojo suave (`UserX`).
  - **Modal Preventivo de Confirmación:**
    - Se despliega al pulsar "Quitar" sobre un beneficiario.
    - Advierte explícitamente:
      > *"¿Estás seguro de quitar a [Nombre] del programa de subsidio? El precio del almuerzo volverá a ser **$5.000 COP** a partir de su **siguiente reserva**. Las reservas ya realizadas anteriormente no cambiarán de precio."*
    - Botones: *Cancelar* y *Sí, quitar beneficio*.

---

## 🎓 4. Interfaz del Aprendiz

- **Identificación de Beneficiario:**
  - Badge prominente **"Beneficiario ($0 Gratis)"** en el banner de bienvenida (`InicioSection.tsx`).
  - Badge ámbar en la tarjeta del menú diario (`MenuCard.tsx`).
- **Visualización de Precio:**
  - Se muestra `$0` destacado con la etiqueta institucional *"Subsidio 100%"*.
- **Reserva con un Solo Clic:**
  - El botón principal cambia su llamada a la acción a **"Reservar Almuerzo (Gratis)"** con icono de rayo (`Zap`).
  - Al hacer clic, **no se muestra el modal de pago de $5.000**. La orden se envía y confirma inmediatamente con un banner de éxito:
    > *"¡Almuerzo reservado con éxito! Tarifa: $0 COP (Beneficio 100% Subsidiado). Presenta tu documento o ficha en el comedor."*

---

## 🔌 5. Contrato de Endpoints con el Backend

El frontend interactúa a través del hook `useBeneficiarios.ts` con la siguiente especificación de API:

### 1. Listar Estudiantes Aprendices
- **Ruta:** `GET /api/beneficiarios/estudiantes`
- **Permisos:** Rol `encargado`
- **Respuesta (200 OK):**
```json
[
  {
    "id": "usr_aprendiz_01",
    "name": "Carlos Ruiz",
    "document": "1005678901",
    "email": "carlos.ruiz@misena.edu.co",
    "es_beneficiario": true,
    "ficha": "2847251",
    "activo": true,
    "created_at": "2026-02-10T08:00:00Z"
  }
]
```

### 2. Listar Beneficiarios Activos
- **Ruta:** `GET /api/beneficiarios`
- **Permisos:** Rol `encargado`
- **Respuesta (200 OK):** Lista de aprendices con `es_beneficiario: true`.

### 3. Asignar o Revocar Subsidio
- **Ruta:** `PATCH /api/beneficiarios/:usuarioId`
- **Permisos:** Rol `encargado`
- **Cuerpo (Request Body):**
```json
{
  "es_beneficiario": true
}
```
- **Respuesta (200 OK):**
```json
{
  "message": "Se asignó el beneficio de almuerzo gratis ($0) a Carlos Ruiz.",
  "aprendiz": {
    "id": "usr_aprendiz_01",
    "name": "Carlos Ruiz",
    "document": "1005678901",
    "es_beneficiario": true
  }
}
```

---

## 📦 6. Estado de Implementación

- **Conectado al backend real:** `hooks/useBeneficiarios.ts` usa solo la API. Se eliminó el fallback a `localStorage`.
- **Rutas montadas:** `backend/src/routes/beneficiarios.routes.ts` (solo rol `encargado`), con validación Zod y tests de integración (`beneficiarios.integration.test.ts`).
- **Panel del Aprendiz:** el estado de beneficiario se lee de `GET /api/menus/activo` (`es_beneficiario`, `precio_aplicable`), que consulta la base de datos en cada llamada. Si el Encargado asigna o quita el beneficio, el aprendiz lo ve al refrescar el menú, sin volver a iniciar sesión.
- **Reserva con un clic:** `ReservaAlmuerzoCard` envía `POST /api/consumos/reservar` solo con el `menu_id`; nunca envía un precio.
- **Contrato:** `email` puede venir `null` desde la API; el hook lo normaliza a `''` para el buscador.
