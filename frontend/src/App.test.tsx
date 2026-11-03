import { describe, it, expect, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueryClient } from '@tanstack/react-query';
import { AppRoutes } from './App';
import LoginPage from './pages/LoginPage';
import { apiClient } from './lib/api';
import { LOGOUT_EVENT, rutaInicio } from './lib/session';
import { AUTH_QUERY_KEY } from './hooks/useAuth';
import { queryKeys } from './hooks/queryKeys';
import { renderConProveedores, respuesta, usuarioDePrueba } from './test/utils';
import type { AccountType } from './schemas/auth.schema';

// Los paneles se reemplazan por su título y el Sidebar real: aquí solo se prueban las rutas y la sesión
vi.mock('./pages/AprendizDashboardPage', async () => {
  const { panelDePrueba } = await import('./test/utils');
  return { AprendizDashboardPage: panelDePrueba('Panel Aprendiz') };
});
vi.mock('./pages/InstructorDashboardPage', async () => {
  const { panelDePrueba } = await import('./test/utils');
  return { InstructorDashboardPage: panelDePrueba('Panel Instructor') };
});
vi.mock('./pages/EncargadoDashboardPage', async () => {
  const { panelDePrueba } = await import('./test/utils');
  return { EncargadoDashboardPage: panelDePrueba('Panel Encargado') };
});
vi.mock('./pages/InvitadoDashboardPage', async () => {
  const { panelDePrueba } = await import('./test/utils');
  return { InvitadoDashboardPage: panelDePrueba('Panel Invitado') };
});

const PANELES: Record<AccountType, string> = {
  aprendiz: 'Panel Aprendiz',
  instructor: 'Panel Instructor',
  encargado: 'Panel Encargado',
  invitado: 'Panel Invitado',
};

/** Simula una sesión guardada que el backend reconoce en GET /auth/me; sin token responde 401. */
const conSesion = (role: AccountType) => {
  localStorage.setItem('gastrosena_token', 'token-valido');
  vi.spyOn(apiClient, 'get').mockImplementation(async () => {
    if (!localStorage.getItem('gastrosena_token')) {
      throw Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 401 } });
    }
    return respuesta({ user: usuarioDePrueba({ role }), activeSession: true });
  });
};

describe('Formulario de login', () => {
  it('ya no muestra botones de tipo de cuenta: solo documento, contraseña, Ingresar y Registrarse', async () => {
    renderConProveedores(<LoginPage />, { ruta: '/login' });

    expect(await screen.findByLabelText(/Documento de Identidad/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrarse' })).toBeInTheDocument();

    expect(screen.queryByText(/Tipo de Cuenta/i)).not.toBeInTheDocument();
    for (const tipo of ['Aprendiz', 'Instructor', 'Encargado', 'Invitado']) {
      expect(screen.queryByRole('button', { name: new RegExp(tipo, 'i') })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /Reconocimiento Facial/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Ficha/i)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'GastroSENA' })).toHaveAttribute(
      'src',
      `${import.meta.env.BASE_URL}logo.png`
    );
  });

  it('valida el documento antes de llamar al backend', async () => {
    const post = vi.spyOn(apiClient, 'post');
    renderConProveedores(<LoginPage />, { ruta: '/login' });

    await userEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText(/al menos 6 dígitos/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('muestra el error genérico del backend si las credenciales son inválidas', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 401, data: { message: 'Credenciales inválidas' } },
      })
    );
    renderConProveedores(<AppRoutes />, { ruta: '/login' });

    await userEvent.type(await screen.findByLabelText(/Documento de Identidad/), '1005678901');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'mala-clave');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
  });
});

describe('Redirección después del login', () => {
  it.each(Object.entries(PANELES) as [AccountType, string][])(
    'un login exitoso de %s abre su panel',
    async (role, panel) => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(
        respuesta({ token: 'jwt', user: usuarioDePrueba({ role }), message: 'ok' })
      );
      // El Sidebar del panel pide el resumen de consumos: sin esto saldría a la red
      vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta({}));
      renderConProveedores(<AppRoutes />, { ruta: '/login' });

      await userEvent.type(await screen.findByLabelText(/Documento de Identidad/), '1005678901');
      await userEvent.type(screen.getByLabelText(/Contraseña/), 'clave-segura');
      await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

      expect(await screen.findByRole('heading', { name: panel })).toBeInTheDocument();
      // El rol no se envía: lo decide el backend
      expect(post).toHaveBeenCalledWith('/auth/login', { document: '1005678901', password: 'clave-segura' });
      expect(localStorage.getItem('gastrosena_token')).toBe('jwt');
    }
  );
});

describe('Rutas protegidas', () => {
  it('sin sesión, una ruta de panel lleva al login', async () => {
    renderConProveedores(<AppRoutes />, { ruta: '/encargado/inicio' });
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.queryByText('Panel Encargado')).not.toBeInTheDocument();
  });

  it('con sesión, /login lleva al panel del rol', async () => {
    conSesion('instructor');
    renderConProveedores(<AppRoutes />, { ruta: '/login' });
    expect(await screen.findByRole('heading', { name: 'Panel Instructor' })).toBeInTheDocument();
  });

  it('un rol no puede entrar al panel de otro', async () => {
    conSesion('aprendiz');
    renderConProveedores(<AppRoutes />, { ruta: '/encargado/inicio' });
    expect(await screen.findByRole('heading', { name: 'Panel Aprendiz' })).toBeInTheDocument();
    expect(screen.queryByText('Panel Encargado')).not.toBeInTheDocument();
  });

  it('una ruta desconocida con sesión termina en el panel del rol', async () => {
    conSesion('invitado');
    renderConProveedores(<AppRoutes />, { ruta: '/no-existe' });
    expect(await screen.findByRole('heading', { name: 'Panel Invitado' })).toBeInTheDocument();
  });
});

describe('Cerrar sesión', () => {
  /** Claves de las consultas en caché que guardan datos. */
  const consultasConDatos = (queryClient: QueryClient) =>
    queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.data !== undefined)
      .map((q) => q.queryKey);

  /** Abre el panel del rol con sesión activa y espera a que el Sidebar termine de cargar. */
  const abrirPanel = async (role: AccountType) => {
    conSesion(role);
    const { queryClient } = renderConProveedores(<AppRoutes />, { ruta: rutaInicio(role) });
    expect(await screen.findByRole('heading', { name: PANELES[role] })).toBeInTheDocument();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    return queryClient;
  };

  /** Login visible sin recargar, token borrado y ningún dato del usuario anterior en caché. */
  const expectSesionCerrada = async (queryClient: QueryClient, role: AccountType) => {
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: PANELES[role] })).not.toBeInTheDocument();
    expect(localStorage.getItem('gastrosena_token')).toBeNull();
    expect(queryClient.getQueryData(AUTH_QUERY_KEY)).toBeNull();
    expect(consultasConDatos(queryClient)).toEqual([AUTH_QUERY_KEY]);
  };

  it.each(Object.keys(PANELES) as AccountType[])(
    'el botón "Cerrar Sesión" del Sidebar de %s muestra el login',
    async (role) => {
      const queryClient = await abrirPanel(role);

      await userEvent.click(screen.getByRole('button', { name: 'Cerrar Sesión' }));

      await expectSesionCerrada(queryClient, role);
    }
  );

  it('el evento gastrosena:logout (un 401 del backend) muestra el login', async () => {
    const queryClient = await abrirPanel('aprendiz');
    expect(consultasConDatos(queryClient)).toContainEqual(queryKeys.resumenConsumos);

    act(() => {
      window.dispatchEvent(new Event(LOGOUT_EVENT));
    });

    await expectSesionCerrada(queryClient, 'aprendiz');
  });
});
