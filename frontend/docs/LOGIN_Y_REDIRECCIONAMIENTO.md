# Arquitectura del Login, Redireccionamiento y Activos Visuales

Este documento especifica el funcionamiento del módulo de autenticación de GastroSENA, el sistema de protección y redirección de rutas y el tratamiento de los recursos gráficos oficiales.

---

## 🎨 1. Activos Visuales Oficiales

### Logo Oficial GastroSENA (`public/logo.png`)
- **Descripción:** Emblema circular con llama en degradé naranja-rojo, silueta de gorro de chef blanco con hoja orgánica en tono tierra y la tipografía oficial *GastroSENA*.
- **Implementación (`Header.tsx`):**
  - Contenedor con relación de aspecto fija (`aspect-square`) y dimensiones responsivas (`w-20 h-20` en dispositivos de 360px y `w-28 h-28` en tablets y escritorio).
  - Propiedad `object-contain` para impedir distorsiones o deformaciones de la imagen.
  - Borde institucional verde esmeralda y sombra elevada (`shadow-2xl`).

### Fotografía de Fondo del Comedor (`public/cafeteria-bg.jpg`)
- **Descripción:** Fotografía real del comedor estudiantil de la Escuela Gastronómica Surcolombiana (Centro de Gestión y Desarrollo Sostenible Surcolombiano - Yamboró), destacando su techo en guadua y mesas de acero inoxidable.
- **Optimización Web:**  
  - Se procesó mediante codificación JPEG a calidad balanceada (75%), reduciendo su tamaño de **492.8 KB a 161.5 KB** (~67% de ahorro en ancho de banda).
- **Implementación (`AuthLayout.tsx`):**
  - Capa fija con `bg-cover bg-center`.
  - **Color de respaldo (`bg-emerald-950`):** Previene destellos blancos o áreas vacías mientras la imagen carga en conexiones lentas.
  - **Overlay degradado translúcido:** Degradado diagonal de verde oscuro institucional a ámbar profundo (`from-green-950/85 via-emerald-900/75 to-amber-950/80`) para asegurar que todo texto, botón o formulario conserve un contraste accesible y legible (WCAG AA).

---

## 🛡️ 2. Flujo de Redireccionamiento y Seguridad de Rutas

El componente raíz `App.tsx` evalúa el estado de autenticación y la ruta solicitada en cada render mediante un cálculo de ruta efectiva pura (`useMemo`), sincronizando la URL del navegador sin generar bucles de render.

### Caso 5.a: Sesión Activa hacia `/` o `/login`
- **Regla:** Si un usuario con sesión válida (token y rol persistidos) entra a la raíz `/` o al formulario `/login`, el sistema no lo retiene en la pantalla de inicio de sesión.
- **Acción:** Se calcula la ruta efectiva como `/${activeRole}/inicio` y se actualiza la dirección mediante `window.history.replaceState`.
- **Destinos:**
  - `aprendiz` $\rightarrow$ `/aprendiz/inicio`
  - `encargado` $\rightarrow$ `/encargado/inicio`
  - `instructor` $\rightarrow$ `/instructor/inicio`
  - `invitado` $\rightarrow$ `/invitado/inicio`

### Caso 5.b: Control de Acceso entre Roles (Role Guard)
- **Regla:** Un usuario autenticado bajo un rol no puede acceder al panel privado de otro rol (por ejemplo, un `aprendiz` intentando cargar manualmente `/encargado/inicio` o `/instructor/inicio`).
- **Acción:** El sistema detecta que el prefijo de la URL pertenece a un rol protegido distinto al autorizado para el usuario actual y lo redirige automáticamente a su propio panel: `/${activeRole}/inicio`.

### Caso 5.c: Usuario No Autenticado en Rutas Protegidas
- **Regla:** Cualquier visitante sin sesión activa (`!isAuthenticated`) que intente abrir una ruta protegida (`/aprendiz/*`, `/encargado/*`, `/instructor/*`, `/invitado/*`) debe ser bloqueado.
- **Acción:** La ruta efectiva se resuelve como `/login`, se reemplaza la entrada en el historial del navegador y se presenta exclusivamente la pantalla de login.

### Caso 5.d: Expiración de Token / Respuesta HTTP 401
- **Regla:** Si una petición a la API del backend responde con código de estado HTTP `401 Unauthorized` (token vencido o manipulado), la sesión debe destruirse de inmediato.
- **Acción:**
  1. El interceptor de respuesta en `lib/api.ts` elimina `gastrosena_token`, `gastrosena_role` y `gastrosena_user` de `localStorage`.
  2. Dispara el evento global de navegador `window.dispatchEvent(new Event('gastrosena:logout'))`.
  3. `App.tsx` escucha dicho evento, invalida el caché de React Query y fuerza la redirección a `/login`.

---

## 🔒 3. Seguridad en Entornos de Producción

Para garantizar que el código desplegado cumpla con estándares de seguridad:
1. **Cero Credenciales en Código:**  
   Ningún componente (`LoginForm.tsx`, `HelpModal.tsx`, `DemoBanner.tsx`, etc.) contiene contraseñas prellenadas ni documentos hardcodeados. Los campos de formulario inician en blanco (`''`).
2. **Aislamiento de Herramientas DEV:**  
   Los botones de prueba de roles y la barra de depuración de rutas están envueltos en `{import.meta.env.DEV && (...)}`.
3. **Eliminación de Código Muerto (Dead-Code Elimination):**  
   Durante el comando `npm run build`, Vite define `import.meta.env.DEV` como `false`. Los optimizadores de Rollup podan completamente esas ramas, garantizando que ni el HTML ni los identificadores de prueba existan en los paquetes estáticos generados en `dist/`.
