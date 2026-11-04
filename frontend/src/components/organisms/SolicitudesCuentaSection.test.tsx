import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SolicitudesCuentaSection } from './SolicitudesCuentaSection';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta } from '../../test/utils';
import type { SolicitudCuenta } from '../../types/api';

const solicitud = (id: string, nombre: string, rol: SolicitudCuenta['rol']): SolicitudCuenta => ({
  id,
  nombre,
  documento: '10987654' + id.slice(-2),
  email: `${id}@sena.edu.co`,
  rol,
  estado: 'pendiente',
  motivo_rechazo: null,
  fecha: '2026-11-04T15:00:00.000Z',
  revisado_por: null,
  revisado_en: null,
});

const PENDIENTES = [solicitud('sol-01', 'María Gómez', 'instructor'), solicitud('sol-02', 'Pedro Díaz', 'encargado')];

describe('Solicitudes de cuenta (Encargado)', () => {
  it('lista las pendientes y aprueba una tras confirmar', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(PENDIENTES));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(
      respuesta({ message: 'Cuenta de instructor creada para María Gómez. Ya puede iniciar sesión.' })
    );
    renderConProveedores(<SolicitudesCuentaSection />);

    const lista = await screen.findByRole('list', { name: 'Solicitudes de cuenta' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
    expect(get).toHaveBeenCalledWith('/solicitudes-cuenta', { params: { estado: 'pendiente' } });

    await userEvent.click(screen.getByRole('button', { name: 'Aprobar solicitud de María Gómez' }));
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar y crear cuenta' }));

    expect(post).toHaveBeenCalledWith('/solicitudes-cuenta/sol-01/aprobar');
    expect(await screen.findByRole('status')).toHaveTextContent('Ya puede iniciar sesión');
  });

  it('al aprobar un encargado advierte que tendrá acceso completo', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(PENDIENTES));
    renderConProveedores(<SolicitudesCuentaSection />);

    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar solicitud de Pedro Díaz' }));
    expect(screen.getByText(/acceso completo al panel/)).toBeInTheDocument();
  });

  it('rechaza con el motivo escrito', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(PENDIENTES));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta({ message: 'Solicitud de Pedro Díaz rechazada.' }));
    renderConProveedores(<SolicitudesCuentaSection />);

    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar solicitud de Pedro Díaz' }));
    await userEvent.type(screen.getByLabelText(/Motivo/), 'No pertenece al comedor');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar solicitud' }));

    expect(post).toHaveBeenCalledWith('/solicitudes-cuenta/sol-02/rechazar', { motivo: 'No pertenece al comedor' });
  });

  it('el historial pide todas las solicitudes', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta([]));
    renderConProveedores(<SolicitudesCuentaSection />);

    expect(await screen.findByText('No hay solicitudes pendientes.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }));
    expect(await screen.findByText('Todavía no hay solicitudes.')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/solicitudes-cuenta', { params: { estado: 'todas' } });
  });
});
