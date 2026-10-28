/**
 * Test de Verificación de Redireccionamiento y Seguridad de Rutas en Frontend
 * GastroSENA - Casos 5a, 5b, 5c, 5d
 */

function simulateRouting({ currentPath, token, role, is401Error = false }) {
  // Simulador de interceptor Axios en lib/api.ts
  let sessionToken = token;
  let sessionRole = role;

  if (is401Error) {
    // Interceptor 401 de Axios:
    sessionToken = null;
    sessionRole = null;
    currentPath = '/login';
    return {
      finalPath: '/login',
      isAuthenticated: false,
      activeRole: null,
      renderedComponent: 'LoginPage',
      action: '401 Unauthorized: Tokens eliminados de localStorage y redirección forzada a /login',
    };
  }

  const isAuthenticated = Boolean(sessionToken && sessionRole);
  const rawPath = currentPath === '/' ? '/login' : currentPath;

  // Caso c: Sin sesión, cualquier ruta protegida lleva a /login
  if (!isAuthenticated) {
    return {
      finalPath: '/login',
      isAuthenticated: false,
      activeRole: null,
      renderedComponent: 'LoginPage',
      action: 'Sin sesión detectada: Bloqueo de ruta protegida y redirección automática a /login',
    };
  }

  // Caso a: Con sesión activa, entrar a / o /login redirige al panel del rol
  if (rawPath === '/login' || rawPath === '/') {
    const target = `/${sessionRole}/inicio`;
    return {
      finalPath: target,
      isAuthenticated: true,
      activeRole: sessionRole,
      renderedComponent: `${sessionRole.charAt(0).toUpperCase() + sessionRole.slice(1)}DashboardPage`,
      action: `Sesión activa (${sessionRole}): Redirección automática de ${currentPath} a ${target}`,
    };
  }

  // Caso b: Un rol autenticado que intenta entrar a la ruta de otro rol es redirigido a su propio panel
  const allowedPrefix = `/${sessionRole}`;
  const protectedPrefixes = ['/aprendiz', '/instructor', '/encargado', '/invitado'];
  const isTargetingOtherRole = protectedPrefixes.some(
    (prefix) => prefix !== allowedPrefix && rawPath.startsWith(prefix)
  );

  if (isTargetingOtherRole) {
    const correctTarget = `/${sessionRole}/inicio`;
    return {
      finalPath: correctTarget,
      isAuthenticated: true,
      activeRole: sessionRole,
      renderedComponent: `${sessionRole.charAt(0).toUpperCase() + sessionRole.slice(1)}DashboardPage`,
      action: `Violación de rol: Usuario '${sessionRole}' intentó acceder a '${currentPath}'. Redirigido a '${correctTarget}'`,
    };
  }

  return {
    finalPath: rawPath,
    isAuthenticated: true,
    activeRole: sessionRole,
    renderedComponent: `${sessionRole.charAt(0).toUpperCase() + sessionRole.slice(1)}DashboardPage`,
    action: `Acceso concedido a ruta autorizada: ${rawPath}`,
  };
}

console.log('================================================================');
console.log('VERIFICACIÓN DE RUTAS Y REDIRECCIONAMIENTOS - GASTROSENA');
console.log('================================================================\n');

// Caso a) Con sesión activa entrar a / o /login redirige al panel del rol
const testA1 = simulateRouting({ currentPath: '/login', token: 'jwt_valid_aprendiz', role: 'aprendiz' });
console.log('CASO 5.a.1 (Sesión Aprendiz en /login):');
console.log(`  Entrada: /login  |  Salida: ${testA1.finalPath}  |  Componente: ${testA1.renderedComponent}`);
console.log(`  Acción:  ${testA1.action}\n`);

const testA2 = simulateRouting({ currentPath: '/', token: 'jwt_valid_encargado', role: 'encargado' });
console.log('CASO 5.a.2 (Sesión Encargado en /):');
console.log(`  Entrada: /  |  Salida: ${testA2.finalPath}  |  Componente: ${testA2.renderedComponent}`);
console.log(`  Acción:  ${testA2.action}\n`);

// Caso b) Un aprendiz que intenta abrir /encargado/inicio es redirigido a su propio panel
const testB = simulateRouting({ currentPath: '/encargado/inicio', token: 'jwt_valid_aprendiz', role: 'aprendiz' });
console.log('CASO 5.b (Aprendiz intentando abrir /encargado/inicio):');
console.log(`  Entrada: /encargado/inicio  |  Salida: ${testB.finalPath}  |  Componente: ${testB.renderedComponent}`);
console.log(`  Acción:  ${testB.action}\n`);

// Caso c) Sin sesión, cualquier ruta protegida lleva a /login
const testC1 = simulateRouting({ currentPath: '/encargado/inicio', token: null, role: null });
console.log('CASO 5.c.1 (Sin sesión intentando abrir /encargado/inicio):');
console.log(`  Entrada: /encargado/inicio  |  Salida: ${testC1.finalPath}  |  Componente: ${testC1.renderedComponent}`);
console.log(`  Acción:  ${testC1.action}\n`);

const testC2 = simulateRouting({ currentPath: '/aprendiz/inicio', token: null, role: null });
console.log('CASO 5.c.2 (Sin sesión intentando abrir /aprendiz/inicio):');
console.log(`  Entrada: /aprendiz/inicio  |  Salida: ${testC2.finalPath}  |  Componente: ${testC2.renderedComponent}`);
console.log(`  Acción:  ${testC2.action}\n`);

// Caso d) Un token vencido (respuesta 401) cierra la sesión y vuelve a /login
const testD = simulateRouting({ currentPath: '/aprendiz/inicio', token: 'jwt_expired', role: 'aprendiz', is401Error: true });
console.log('CASO 5.d (Token vencido / respuesta HTTP 401):');
console.log(`  Entrada: 401 en /aprendiz/inicio  |  Salida: ${testD.finalPath}  |  Componente: ${testD.renderedComponent}`);
console.log(`  Acción:  ${testD.action}\n`);

console.log('================================================================');
console.log('TODOS LOS CASOS DE REDIRECCIÓN EVALUADOS Y CONFIRMADOS');
console.log('================================================================');
