import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsuariosCoordinadorSection } from './UsuariosCoordinadorSection';
import { apiClient } from '../../../lib/api';
import { renderConProveedores, respuesta, elegirOpcion } from '../../../test/utils';
import type { PaginaUsuarios } from '../../../types/api';

const PAGINA: PaginaUsuarios = {
  total: 2,
  pagina: 1,
  tamano: 25,
  items: [
    {
      id: '00000000-0000-0000-0000-0000000000c1',
      nombre: 'Carlos Ruiz',
      cedula: '1005678901',
      email: 'carlos.ruiz@misena.edu.co',
      telefono: null,
      rol: 'aprendiz',
      estado: 'activo',
      origen: 'registro',
      debe_cambiar_clave: false,
      motivo_rechazo: null,
      fecha_aprobacion: null,
      created_at: '2026-11-01T14:00:00.000Z',
      ficha: '2847251',
      programa: 'ADSO',
    },
    {
      id: '00000000-0000-0000-0000-0000000000c2',
      nombre: 'Ricardo Gómez Vargas',
      cedula: '1043210987',
      email: 'rgomez@correo.com',
      telefono: null,
      rol: 'instructor',
      estado: 'rechazado',
      origen: 'registro',
      debe_cambiar_clave: false,
      motivo_rechazo: 'No figura en la planta de instructores del centro',
      fecha_aprobacion: null,
      created_at: '2026-11-02T14:00:00.000Z',
      ficha: null,
      programa: null,
    },
  ],
};

describe('Usuarios del Coordinador', () => {
  it('filtra por rol y estado con la API', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(PAGINA));
    renderConProveedores(<UsuariosCoordinadorSection />);

    expect(await screen.findByText('Carlos Ruiz')).toBeInTheDocument();
    expect(screen.getByText(/Motivo: No figura en la planta/)).toBeInTheDocument();

    await elegirOpcion(/Rol/, 'Instructores');
    await elegirOpcion(/Estado/, 'Activos');

    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/coordinador/usuarios', {
        params: { rol: 'instructor', estado: 'activo', pagina: 1, tamano: 25 },
      })
    );
  });

  it('restablece la contraseña de una cuenta y muestra el mensaje del backend', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(PAGINA));
    const mensaje = 'La contraseña de Carlos Ruiz volvió a ser su número de documento. Deberá cambiarla al ingresar.';
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta({ message: mensaje }));
    renderConProveedores(<UsuariosCoordinadorSection />);

    await userEvent.click(await screen.findByRole('button', { name: 'Restablecer la contraseña de Carlos Ruiz' }));
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Restablecer contraseña' })).getByRole('button', { name: 'Restablecer' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(`/coordinador/usuarios/${PAGINA.items[0].id}/restablecer-clave`));
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
  });

  it('una cuenta rechazada no tiene acciones de activar o restablecer', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(PAGINA));
    renderConProveedores(<UsuariosCoordinadorSection />);

    expect(await screen.findByText('Ricardo Gómez Vargas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restablecer la contraseña de Ricardo Gómez Vargas' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Desactivar/ })).toHaveLength(1);
  });
});
