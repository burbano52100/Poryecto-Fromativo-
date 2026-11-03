# Login, rutas y redireccionamiento

Cómo funciona el inicio de sesión de GastroSENA, cómo se protegen las rutas de cada rol y cómo se cargan las imágenes de la pantalla de login.

---

## 1. Inicio de sesión

El formulario (`components/organisms/LoginForm.tsx`) pide **solo documento y contraseña**. Ya no hay botones de tipo de cuenta, ni "Modo Invitado", ni reconocimiento facial, ni accesos rápidos de desarrollo.

1. El formulario valida con Zod (`schemas/auth.schema.ts` → `loginSchema`): documento de 6 a 12 números y contraseña obligatoria.
2. `useLoginMutation` (`hooks/useAuth.ts`) envía `POST /api/auth/login` con `{ document, password }`.
3. El backend busca el usuario por cédula y toma el rol de `usuarios.rol`. Lo devuelve en el token y en `user.role`.
4. Si las credenciales fallan, el backend responde siempre `401 "Credenciales inválidas"`, sin decir si falló el documento o la contraseña. El formulario muestra ese mensaje.
5. Si el login es correcto, se guarda la sesión (`lib/session.ts`) y se publica el usuario en la caché de React Query (`AUTH_QUERY_KEY`). La página de login ve al usuario y redirige sola a `/{rol}/inicio`.

El enlace **"Registrarse"** abre `RegisterModal`. El registro sí pide tipo de cuenta, pero solo ofrece **Aprendiz** (con su número de Ficha) e **Invitado**. Instructores y encargados no se registran solos. Al registrarse, el usuario queda con la sesión iniciada y entra a su panel.

---

## 2. Rutas (HashRouter)

`App.tsx` usa `HashRouter`, así que las URLs quedan como `#/login` o `#/aprendiz/inicio`. De esta forma, recargar la página funciona en GitHub Pages (ADR 004). Cada panel se carga con `lazy()`, en su propio archivo JS.

| Ruta | Quién entra |
|---|---|
| `#/login` | Cualquiera. Con sesión activa redirige a `#/{rol}/inicio`. |
| `#/aprendiz/inicio` | Solo `aprendiz` |
| `#/instructor/inicio` | Solo `instructor` |
| `#/encargado/inicio` | Solo `encargado` |
| `#/invitado/inicio` | Solo `invitado` |
| Cualquier otra | Redirige a `#/login` (y de ahí al panel si hay sesión). |

`routes/ProtectedRoute.tsx` aplica las reglas:
- **Sin sesión** → `#/login`.
- **Sesión de otro rol** → el panel de su propio rol (por ejemplo, un aprendiz que abre `#/encargado/inicio` vuelve a `#/aprendiz/inicio`).
- Mientras se verifica la sesión con `GET /api/auth/me`, muestra un indicador de carga.

### Sesión vencida (401)
1. El interceptor de `lib/api.ts` borra la sesión de `localStorage` y dispara el evento `gastrosena:logout`. Excepción: los 401 de `/auth/login` y `/auth/register` son errores de credenciales y no disparan nada.
2. `AppRoutes` escucha el evento y ejecuta `useLogout`, el mismo que usa el botón "Cerrar Sesión" del Sidebar.
3. `ProtectedRoute` ve que no hay sesión y lleva a `#/login`, sin recargar la página.

### Qué hace `useLogout` (`hooks/useAuth.ts`)
1. `limpiarSesion()` borra token, rol y usuario de `localStorage`.
2. `setQueryData(['currentUser'], null)` vacía la consulta de sesión. `ProtectedRoute` la está observando y redirige al login.
3. `removeQueries` descarta todas las demás consultas, para que el siguiente usuario no vea datos del anterior.

No se usa `queryClient.clear()`: borraría también la consulta de sesión, `ProtectedRoute` quedaría observando la consulta eliminada y la pantalla no cambiaría hasta recargar con F5.

---

## 3. Imágenes de la pantalla de login

- **Fondo:** `public/cafeteria-bg.jpg` a pantalla completa (`bg-cover bg-center`), con una capa oscura semitransparente (`bg-gray-950/65`) para que el formulario se lea bien (`components/templates/AuthLayout.tsx`).
- **Logo:** `public/logo.png`, centrado arriba del formulario, con `alt="GastroSENA"` (`components/organisms/Header.tsx`).
- **Tarjeta:** blanca, centrada, con bordes redondeados y sombra; ocupa el ancho disponible hasta `max-w-md`, así que funciona en celular.

Vite publica la app bajo `base: '/Poryecto-Fromativo-/'`. Por eso **las imágenes de `public/` no se referencian con `/archivo.png`**, sino con el helper `asset()` de `lib/assets.ts`, que antepone `import.meta.env.BASE_URL`:

```tsx
import { asset } from '../../lib/assets';
<img src={asset('/logo.png')} alt="GastroSENA" />
```

Para imágenes que llegan del backend (por ejemplo, `imagen_url` del menú), usar `resolverImagen(url)`: deja intactas las URLs absolutas y pasa por `asset()` las rutas de `public/`.

---

## 4. Tests

`src/App.test.tsx` (Vitest + Testing Library) verifica:
- El formulario ya no muestra botones de tipo de cuenta ni campo de Ficha: solo documento, contraseña, "Ingresar" y "Registrarse".
- Un login exitoso de cada rol abre su panel, y el rol no se envía en la petición.
- Un error de credenciales muestra el mensaje genérico del backend.
- Sin sesión, una ruta de panel lleva al login; con sesión, `/login` lleva al panel; un rol no entra al panel de otro.

Ejecutar con `npm test` dentro de `frontend/`.
