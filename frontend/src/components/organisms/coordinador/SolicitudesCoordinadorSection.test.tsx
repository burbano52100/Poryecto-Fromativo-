import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SolicitudesCoordinadorSection } from './SolicitudesCoordinadorSection';
import { apiClient } from '../../../lib/api';
import { renderConProveedores, respuesta } from '../../../test/utils';
import type { CuentaGestionada } from '../../../types/api';

const cuenta = (overrides: Partial<CuentaGestionada>): CuentaGestionada => ({
  id: '00000000-0000-0000-0000-00000000000a',
  nombre: 'Luis Alberto Pérez',
  cedula: '1065432101',
  email: 'lperez@sena.edu.co',
  telefono: null,
  rol: 'instructor',
  estado: 'pendiente',
  origen: 'registro',
  debe_cambiar_clave: false,
  motivo_rechazo: null,
  fecha_aprobacion: null,
  created_at: '2026-11-15T14:00:00.000Z',
  ficha: null,
  programa: null,
  ...overrides,
});

const SOLICITUDES = [
  cuenta({}),
  cuenta({
    id: '00000000-0000-0000-0000-00000000000b',
    nombre: 'Camila Andrea Ortiz',
    cedula: '1005678910',
    rol: 'aprendiz',
    ficha: '2847252',
    programa: 'Gestión Logística Integral',
  }),
];

describe('Solicitudes del Coordinador', () => {
  it('lista las cuentas pendientes y aprueba varias a la vez', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(SOLICITUDES));
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue(respuesta({ message: 'Se aprobaron 2 cuentas.', aprobadas: 2 }));
    renderConProveedores(<SolicitudesCoordinadorSection />);

    expect(await screen.findByText('Luis Alberto Pérez')).toBeInTheDocument();
    expect(screen.getByText(/Ficha 2847252/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Seleccionar todas'));
    await userEvent.click(screen.getByRole('button', { name: /Aprobar selección/ }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Aprobar solicitud' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aprobar 2 cuentas' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/coordinador/solicitudes/aprobar', { ids: SOLICITUDES.map((s) => s.id) })
    );
    expect(await screen.findByText('Se aprobaron 2 cuentas.')).toBeInTheDocument();
  });

  it('rechazar exige un motivo de al menos 3 caracteres', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(SOLICITUDES));
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue(respuesta({ message: 'Se rechazó la solicitud de Luis Alberto Pérez.', rechazadas: 1 }));
    renderConProveedores(<SolicitudesCoordinadorSection />);

    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar solicitud de Luis Alberto Pérez' }));
    const boton = within(screen.getByRole('dialog', { name: 'Rechazar solicitud' })).getByRole('button', { name: 'Rechazar' });
    expect(boton).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Motivo del rechazo'), 'No es instructor del centro');
    await userEvent.click(boton);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/coordinador/solicitudes/rechazar', {
        ids: [SOLICITUDES[0].id],
        motivo: 'No es instructor del centro',
      })
    );
  });
});
