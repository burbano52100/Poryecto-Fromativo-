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
  it('ofrece solo aprendiz e instructor (ADR 018), y pide mínimo 8 caracteres de contraseña', () => {
    renderConProveedores(<RegisterModal isOpen onClose={() => {}} />);

    const tipos = screen.getAllByRole('radio');
    expect(tipos.map((b) => b.textContent)).toEqual(['Aprendiz', 'Instructor']);
    expect(screen.getByLabelText(/^Contraseña/)).toHaveAttribute('placeholder', 'Mínimo 8 caracteres');
  });

  it('un instructor envía una solicitud: ve el aviso, no inicia sesión y no se cierra solo', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(
      respuesta({
        message: 'Solicitud enviada. El Coordinador debe aprobar tu cuenta de instructor antes de que puedas ingresar.',
        solicitud: { id: 'sol-1', rol: 'instructor', estado: 'pendiente' },
      })
    );
    const onClose = vi.fn();
    renderConProveedores(<RegisterModal isOpen onClose={onClose} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Instructor' }));
    expect(screen.getByText(/el Coordinador revisará tu solicitud/)).toBeInTheDocument();
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

  it('un aprendiz también queda pendiente del Coordinador y envía su ficha', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(
      respuesta({
        message: 'Solicitud enviada. El Coordinador debe aprobar tu cuenta de aprendiz antes de que puedas ingresar.',
        solicitud: { id: 'sol-2', rol: 'aprendiz', estado: 'pendiente' },
      })
    );
    renderConProveedores(<RegisterModal isOpen onClose={() => {}} />);

    expect(screen.getByText(/el Coordinador revisará tu solicitud/)).toBeInTheDocument();
    await llenarDatosBasicos('1234567890');
    await userEvent.type(screen.getByLabelText(/Número de Ficha/), '2847251');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('heading', { name: 'Solicitud enviada' })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ accountType: 'aprendiz', ficha: '2847251' }));
    expect(localStorage.getItem('gastrosena_token')).toBeNull();
  });

  it('si la cédula ya estaba en una carga masiva, la cuenta se activa e inicia sesión', async () => {
    const mensaje = 'Tu cédula estaba en la lista del Coordinador: tu cuenta quedó activa.';
    vi.spyOn(apiClient, 'post').mockResolvedValue(
      respuesta({ token: 'jwt-aprendiz', user: usuarioDePrueba({ role: 'aprendiz' }), message: mensaje })
    );
    renderConProveedores(<RegisterModal isOpen onClose={() => {}} />);

    await llenarDatosBasicos('1005678920');
    await userEvent.type(screen.getByLabelText(/Número de Ficha/), '2847251');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(localStorage.getItem('gastrosena_token')).toBe('jwt-aprendiz');
  });
});
