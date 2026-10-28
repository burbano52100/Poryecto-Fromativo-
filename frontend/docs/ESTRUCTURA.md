# Arquitectura y Estructura del Frontend - GastroSENA

El frontend de GastroSENA está construido con **React 19**, **TypeScript**, **Vite** y **Tailwind CSS v4**, siguiendo los principios de modularidad y la metodología de diseño de interfaces **Atomic Design**.

---

## 🌳 Árbol General de Directorios

```
frontend/
├── docs/                   # Documentación técnica obligatoria del frontend
├── public/                 # Archivos estáticos servidos directamente (logo, fondos, favicons)
├── src/
│   ├── assets/             # Recursos vectoriales y gráficos importables en bundler
│   ├── components/         # Jerarquía de componentes bajo Atomic Design
│   │   ├── atoms/          # Componentes básicos indivisibles
│   │   ├── molecules/      # Combinaciones de átomos con propósito puntual
│   │   ├── organisms/      # Secciones complejas y módulos autónomos
│   │   └── templates/      # Layouts estructurales de página
│   ├── hooks/              # Custom hooks y consultas TanStack React Query v5
│   ├── lib/                # Clientes HTTP (Axios), utilidades y servicios de API
│   ├── pages/              # Vistas completas de página (rutas principales)
│   ├── routes/             # Componentes de guardia y enrutamiento protegido
│   ├── schemas/            # Esquemas de validación Zod y tipos inferidos
│   ├── types/              # Definiciones e interfaces TypeScript complementarias
│   ├── App.tsx             # Componente raíz con control de rutas y guardias de rol
│   ├── main.tsx            # Punto de entrada de la aplicación y QueryClientProvider
│   └── index.css           # Estilos globales y directivas de Tailwind CSS
├── package.json            # Dependencias del proyecto y scripts npm
├── tsconfig.json           # Configuración del compilador TypeScript
└── vite.config.ts          # Configuración del empaquetador Vite
```

---

## 🧩 Descripción Detallada por Capas

### 1. `frontend/docs/`
Directorio obligatorio para registrar cada cambio técnico y funcional. Contiene:
- `README.md`: Índice y reglas de commit.
- `CHANGELOG.md`: Registro cronológico histórico.
- `LOGIN_Y_REDIRECCIONAMIENTO.md`: Documento de autenticación, rutas y seguridad.
- `PASO_5_BENEFICIARIOS.md`: Especificación del subsidio $0 para Encargado y Aprendiz.
- `PENDIENTES_BACKEND.md`: Lista de endpoints requeridos y discrepancias de API.
- `ESTRUCTURA.md`: Este documento arquitectónico.

---

### 2. `frontend/public/`
Archivos multimedia y estáticos servidos sin procesar por Vite:
- `logo.png`: Emblema oficial circular GastroSENA.
- `cafeteria-bg.jpg`: Fotografía real optimizada del comedor de la sede Yamboró (~161 KB).
- `favicon.svg` e `icons.svg`: Iconografía web para pestañas del navegador.

---

### 3. `frontend/src/components/` (Atomic Design)

#### A. `atoms/` (Átomos)
Elementos mínimos de UI sin lógica de negocio:
- `Button.tsx`: Botón universal con variantes (`primary`, `secondary`, `outline`, `danger`, `emerald`, `ghost`), estados de carga (`isLoading`) y soporte para iconos.
- `Input.tsx`: Campo de entrada de texto estandarizado con foco accesible.
- `Label.tsx`: Etiquetas de formulario con indicador de campo obligatorio.
- `Badge.tsx`: Pastillas de estado con variantes cromáticas (verde, ámbar, rojo, gris).
- `StatCard.tsx`: Tarjeta base para métricas numéricas.
- `AccountTypeButton.tsx`: Botón de selección para el tipo de rol en el login.

#### B. `molecules/` (Moléculas)
Combinaciones de átomos que resuelven una interacción puntual:
- `FormField.tsx`: Agrupación de `Label` + `Input` + mensajes de error de validación + icono.
- `AccountTypeSelector.tsx`: Selector visual de pestañas para Aprendiz, Instructor, Encargado e Invitado.
- `MenuCard.tsx`: Tarjeta interactiva del menú diario con precio (incluye tarifa $0 para beneficiarios), disponibilidad y llamada a reserva.
- `SidebarNavItem.tsx`: Enlace de navegación con soporte para acento por rol, badges y sub-ítems colapsables.
- `SidebarUserProfile.tsx`: Tarjeta de perfil inferior en el sidebar con avatar y documento.
- `ProgressCard.tsx` y `ScheduleCard.tsx`: Tarjetas informativas de horarios y avance de consumos.

#### C. `organisms/` (Organismos)
Módulos funcionales de alto nivel que encapsulan estado y llamadas a hooks:
- `BeneficiariosSection.tsx`: **Módulo de Beneficiarios (Paso 5)** para el Encargado, con pestañas de todos los estudiantes y beneficiarios actuales, búsqueda, filtros y modal de revocación.
- `LoginForm.tsx`: Formulario de inicio de sesión reactivo con `react-hook-form` y `zodResolver`.
- `DevQuickLogin.tsx`: Herramientas de acceso rápido exclusivas para entorno de desarrollo (`import.meta.env.DEV`).
- `Sidebar.tsx`: Menú lateral adaptable con soporte responsive (drawer móvil y desktop fijo).
- `Header.tsx`: Encabezado visual del login con logo oficial enmarcado.
- `HelpModal.tsx`: Centro de ayuda y canales de soporte institucional.
- `RegisterModal.tsx`: Formulario emergente para registro de nuevos usuarios.
- `VentasSection.tsx`, `MenuDelDiaEncargadoSection.tsx`, `CarteraDeudasSection.tsx`, `InventarioSection.tsx`, `GruposSection.tsx`: Secciones del panel de administración del Encargado.
- `InicioSection.tsx`, `MisFichasSection.tsx`, `PerfilSection.tsx`: Secciones del panel del Aprendiz.

#### D. `templates/` (Plantillas)
Esquemas de disposición espacial que estructuran las páginas:
- `AuthLayout.tsx`: Estructura centrada con fondo de comedor, overlay de contraste y pie de página institucional para el login.
- `DashboardLayout.tsx`: Estructura principal de paneles con sidebar lateral, barra superior de título por sección y área de contenido responsiva.

---

### 4. `frontend/src/hooks/`
Hooks personalizados que conectan la UI con TanStack React Query v5:
- `useAuth.ts`: Consulta del usuario en sesión (`GET /api/auth/me`), mutaciones de login, registro y biometría facial.
- `useBeneficiarios.ts`: Consultas de aprendices registrados (`GET /api/beneficiarios/estudiantes`), beneficiarios activos (`GET /api/beneficiarios`) y mutación de subsidio (`PATCH /api/beneficiarios/:usuarioId`).
- `useCartera.ts`: Gestión de cuentas por cobrar y deudas de instructores.
- `useInventario.ts`: Gestión de stock, recetas, kardex y mermas.
- `useGrupos.ts`: Consulta de fichas de formación.
- `useSugerencias.ts`: Buzón de peticiones, quejas y sugerencias.

---

### 5. `frontend/src/lib/`
Servicios de infraestructura y comunicación:
- `api.ts`: Instancia global de `axios` con interceptor de autorización JWT (`Bearer token`) e interceptor de respuesta HTTP 401 para cierre de sesión y redirección reactiva.
- `authService.ts`: Funciones de transporte HTTP para autenticación.

---

### 6. `frontend/src/pages/`
Páginas principales asociadas a los paneles de control:
- `LoginPage.tsx`: Página de autenticación que ensambla `AuthLayout`, `Header` y `LoginForm`.
- `AprendizDashboardPage.tsx`: Panel del Aprendiz (incluye flujo de subsidio a $0 y reserva con 1 clic).
- `EncargadoDashboardPage.tsx`: Panel de administración del Encargado (incluye Módulo de Beneficiarios).
- `InstructorDashboardPage.tsx`: Panel para instructores con historial de consumos y cuenta de crédito.
- `InvitadoDashboardPage.tsx`: Portal para visitantes y eventos especiales.

---

### 7. `frontend/src/schemas/` y `frontend/src/types/`
Garantía de tipado estricto en tiempo de compilación y validación en tiempo de ejecución:
- `auth.schema.ts`: Esquemas Zod para credenciales, registros, respuestas de API y entidad de usuario con `es_beneficiario`.
- `database.ts`: Tipos TypeScript espejados con las tablas de PostgreSQL.
