import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterModal } from './RegisterModal';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta, usuarioDePrueba } from '../../test/utils';

const llenarDatosBasicos = async (documento: string) => {
  await userEvent.type(screen.getByLabelText(/Nombre Completo/), 'María Fernanda Gómez');
  await userEvent.type(screen.getByLabelText(/Documento de Identidad/), documento);
  await userEvent.type(screen.getByLabelText(/Correo Electrónico/), 'mgomez@sena.edu.co');
  await userEvent.type(screen.getByLabelText(/^Contraseña/), 'clave-segura-123');
};

describe('Registro', () => {
  it('ofrece los 4 tipos de cuenta y pide mínimo 8 caracteres de contraseña', () => {
    renderConProveedores(<RegisterModal isOpen onClose={() => {}} />);

    for (const tipo of ['Aprendiz', 'Invitado', 'Instructor', 'Encargado']) {
      expect(screen.getByRole('button', { name: tipo })).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/^Contraseña/)).toHaveAttribute('placeholder', 'Mínimo 8 caracteres');
  });

  it('un instructor envía una solicitud: ve el aviso, no inicia sesión y no se cierra solo', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(
      respuesta({
        message: 'Solicitud enviada. Un encargado del comedor debe aprobar tu cuenta de instructor antes de que puedas ingresar.',
        solicitud: { id: 'sol-1', rol: 'instructor', estado: 'pendiente' },
      })
    );
    const onClose = vi.fn();
    renderConProveedores(<RegisterModal isOpen onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Instructor' }));
    expect(screen.getByText(/necesitan aprobación/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Número de Ficha/)).not.toBeInTheDocument();

    await llenarDatosBasicos('1098765432');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('heading', { name: 'Solicitud enviada' })).toBeInTheDocument();
    expect(screen.getByText(/debe aprobar tu cuenta de instructor/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ accountType: 'instructor', document: '1098765432' }));
    expect(localStorage.getItem('gastrosena_token')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('un invitado sí crea la cuenta e inicia sesión', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue(
      respuesta({ token: 'jwt-invitado', user: usuarioDePrueba({ role: 'invitado' }), message: 'ok' })
    );
    renderConProveedores(<RegisterModal isOpen onClose={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Invitado' }));
    expect(screen.queryByText(/necesitan aprobación/)).not.toBeInTheDocument();
    await llenarDatosBasicos('1234567890');
    await userEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText(/Cuenta creada correctamente/)).toBeInTheDocument();
    expect(localStorage.getItem('gastrosena_token')).toBe('jwt-invitado');
  });
});
