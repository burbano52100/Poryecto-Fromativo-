import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from './App';
import LoginPage from './pages/LoginPage';
import { apiClient } from './lib/api';
import { renderConProveedores, respuesta, usuarioDePrueba } from './test/utils';
import type { AccountType } from './schemas/auth.schema';

// Los paneles se reemplazan por marcadores: aquí solo se prueba el enrutamiento
vi.mock('./pages/AprendizDashboardPage', () => ({ AprendizDashboardPage: () => <h1>Panel Aprendiz</h1> }));
vi.mock('./pages/InstructorDashboardPage', () => ({ InstructorDashboardPage: () => <h1>Panel Instructor</h1> }));
vi.mock('./pages/EncargadoDashboardPage', () => ({ EncargadoDashboardPage: () => <h1>Panel Encargado</h1> }));
vi.mock('./pages/InvitadoDashboardPage', () => ({ InvitadoDashboardPage: () => <h1>Panel Invitado</h1> }));

const PANELES: Record<AccountType, string> = {
  aprendiz: 'Panel Aprendiz',
  instructor: 'Panel Instructor',
  encargado: 'Panel Encargado',
  invitado: 'Panel Invitado',
};

/** Simula una sesión guardada que el backend reconoce en GET /auth/me. */
const conSesion = (role: AccountType) => {
  localStorage.setItem('gastrosena_token', 'token-valido');
  vi.spyOn(apiClient, 'get').mockResolvedValue(
    respuesta({ user: usuarioDePrueba({ role }), activeSession: true })
  );
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
