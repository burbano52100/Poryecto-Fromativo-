import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlmuerzosInvitadosSection } from './AlmuerzosInvitadosSection';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta, elegirOpcion } from '../../test/utils';
import type { AlmuerzoInvitado, ResumenAlmuerzosInvitados, TarifasAlmuerzosInvitados } from '../../types/api';

const TARIFAS: TarifasAlmuerzosInvitados = {
  tarifas: [
    { tipo: 'instructor', precio: 10000 },
    { tipo: 'aprendiz', precio: 5000 },
    { tipo: 'corriente', precio: 11000 },
  ],
  maxPersonas: 500,
};

const REGISTRO: AlmuerzoInvitado = {
  id: 'reg-1',
  tipo: 'corriente',
  cantidad: 3,
  precio_unitario: 11000,
  total: 33000,
  nombre_invitado: 'Proveedores de café',
  registrado_por: { id: 'enc-1', nombre: 'Encargada Comedor' },
  fecha_hora: '2026-11-10T17:30:00.000Z',
  fecha_local: '2026-11-10T12:30',
};

const cero = { personas: 0, total: 0, registros: 0 };
const RESUMEN: ResumenAlmuerzosInvitados = {
  hoy: '2026-11-16',
  desde: '2026-11-01',
  hasta: '2026-11-16',
  dia: { porTipo: { instructor: { personas: 2, total: 20000, registros: 1 }, aprendiz: cero, corriente: cero }, personas: 2, total: 20000, registros: 1 },
  periodo: {
    porTipo: { instructor: { personas: 2, total: 20000, registros: 1 }, aprendiz: cero, corriente: { personas: 3, total: 33000, registros: 1 } },
    personas: 5,
    total: 53000,
    registros: 2,
  },
};

const RESPUESTAS: Record<string, unknown> = {
  '/almuerzos-invitados/tarifas': TARIFAS,
  '/almuerzos-invitados/resumen': RESUMEN,
  '/almuerzos-invitados': [REGISTRO],
};

const simularApi = () =>
  vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => respuesta(RESPUESTAS[url]));

/** La tarjeta de un tipo, buscada por su título. */
const tarjeta = async (titulo: string) => within(await screen.findByRole('region', { name: titulo }));

describe('Almuerzos invitados (Encargado)', () => {
  it('muestra las tres separaciones con la tarifa que envía el backend', async () => {
    simularApi();
    renderConProveedores(<AlmuerzosInvitadosSection />);

    expect((await tarjeta('Almuerzos invitados de instructores')).getByText('$10.000')).toBeInTheDocument();
    expect((await tarjeta('Almuerzos invitados de aprendices')).getByText('$5.000')).toBeInTheDocument();
    expect((await tarjeta('Almuerzos invitados corrientes')).getByText('$11.000')).toBeInTheDocument();
  });

  it('los botones + y − cambian el número de personas y el total se calcula en vivo', async () => {
    simularApi();
    renderConProveedores(<AlmuerzosInvitadosSection />);
    const card = await tarjeta('Almuerzos invitados de instructores');
    const campo = card.getByLabelText(/Número de personas/);

    expect(campo).toHaveValue('1');
    expect(card.getByRole('button', { name: /Restar uno/ })).toBeDisabled();
    for (let i = 0; i < 3; i++) await userEvent.click(card.getByRole('button', { name: /Sumar uno/ }));
    expect(campo).toHaveValue('4');
    expect(card.getByText('4 personas × $10.000')).toBeInTheDocument();
    expect(card.getByText('= $40.000')).toBeInTheDocument();

    await userEvent.click(card.getByRole('button', { name: /Restar uno/ }));
    expect(campo).toHaveValue('3');
    expect(card.getByText('= $30.000')).toBeInTheDocument();
  });

  it('el campo solo acepta números y también se puede escribir', async () => {
    simularApi();
    renderConProveedores(<AlmuerzosInvitadosSection />);
    const card = await tarjeta('Almuerzos invitados de aprendices');
    const campo = card.getByLabelText(/Número de personas/);

    await userEvent.clear(campo);
    await userEvent.type(campo, '1a2');
    expect(campo).toHaveValue('12');
    expect(card.getByText('12 personas × $5.000')).toBeInTheDocument();
    expect(card.getByText('= $60.000')).toBeInTheDocument();
  });

  it('registra tipo, personas y nombre; luego limpia el formulario', async () => {
    simularApi();
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta({ ...REGISTRO, tipo: 'instructor', cantidad: 4, total: 40000 }));
    renderConProveedores(<AlmuerzosInvitadosSection />);
    const card = await tarjeta('Almuerzos invitados de instructores');

    const campo = card.getByLabelText(/Número de personas/);
    await userEvent.clear(campo);
    await userEvent.type(campo, '4');
    await userEvent.type(card.getByLabelText(/Nombre o nota/), '  Delegación Neiva ');
    await userEvent.click(card.getByRole('button', { name: 'Registrar' }));

    expect(post).toHaveBeenCalledWith('/almuerzos-invitados', { tipo: 'instructor', cantidad: 4, nombre_invitado: 'Delegación Neiva' });
    // El aviso es un toast de HeroUI: aparece fuera de la tarjeta
    expect(await screen.findByText(/Registrado: 4 personas · \$40\.000/)).toBeInTheDocument();
    expect(campo).toHaveValue('1');
  });

  it('sin nombre envía null', async () => {
    simularApi();
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta(REGISTRO));
    renderConProveedores(<AlmuerzosInvitadosSection />);
    const card = await tarjeta('Almuerzos invitados corrientes');

    await userEvent.click(card.getByRole('button', { name: 'Registrar' }));
    expect(post).toHaveBeenCalledWith('/almuerzos-invitados', { tipo: 'corriente', cantidad: 1, nombre_invitado: null });
  });

  it.each([
    ['', 'Ingresa el número de personas.'],
    ['0', 'El número de personas debe ser mayor a 0.'],
    ['501', 'El número de personas no puede superar 500 por registro.'],
  ])('valida el número de personas "%s" antes de enviar', async (valor, mensaje) => {
    simularApi();
    const post = vi.spyOn(apiClient, 'post');
    renderConProveedores(<AlmuerzosInvitadosSection />);
    const card = await tarjeta('Almuerzos invitados de aprendices');

    const campo = card.getByLabelText(/Número de personas/);
    await userEvent.clear(campo);
    if (valor) await userEvent.type(campo, valor);
    await userEvent.click(card.getByRole('button', { name: 'Registrar' }));

    expect(await card.findByText(mensaje)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('el historial muestra el número de personas y el resumen del día y del período', async () => {
    simularApi();
    renderConProveedores(<AlmuerzosInvitadosSection />);

    const fila = (await screen.findByText('Proveedores de café')).closest('tr')!;
    expect(within(fila).getByText('Corrientes')).toBeInTheDocument();
    expect(within(fila).getByText('3')).toBeInTheDocument();
    expect(within(fila).getByText('$33.000')).toBeInTheDocument();
    expect(within(fila).getByText('Encargada Comedor')).toBeInTheDocument();

    const hoy = within(screen.getByRole('region', { name: 'Resumen de hoy' }));
    expect(hoy.getByText('Total general').closest('tr')).toHaveTextContent('2$20.000');
    const periodo = within(screen.getByRole('region', { name: 'Resumen del período' }));
    expect(periodo.getByText('01/11/2026 – 16/11/2026')).toBeInTheDocument();
    expect(periodo.getByText('Total general').closest('tr')).toHaveTextContent('5$53.000');
  });

  it('filtra por rango de fechas y tipo, y no consulta con un rango inválido', async () => {
    const get = simularApi();
    renderConProveedores(<AlmuerzosInvitadosSection />);
    await screen.findByText('Proveedores de café');

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-05' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-10' } });
    await elegirOpcion(/Tipo/, 'Corrientes');
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/almuerzos-invitados', {
        params: { desde: '2026-11-05', hasta: '2026-11-10', tipo: 'corriente' },
      })
    );
    expect(get).toHaveBeenCalledWith('/almuerzos-invitados/resumen', { params: { desde: '2026-11-05', hasta: '2026-11-10' } });

    get.mockClear();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-12' } });
    expect(await screen.findByText('La fecha inicial no puede ser posterior a la fecha final.')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith('/almuerzos-invitados', expect.anything());
  });

  it('edita un registro: personas y nombre, con el precio guardado', async () => {
    simularApi();
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue(respuesta({ ...REGISTRO, cantidad: 5, total: 55000 }));
    renderConProveedores(<AlmuerzosInvitadosSection />);

    const fila = (await screen.findByText('Proveedores de café')).closest('tr')!;
    await userEvent.click(within(fila).getByRole('button', { name: 'Editar registro' }));
    const modal = within(await screen.findByRole('dialog', { name: 'Editar registro' }));

    expect(modal.getByLabelText(/Número de personas/)).toHaveValue('3');
    expect(modal.getByLabelText(/Fecha y hora/)).toHaveValue('2026-11-10T12:30');
    await userEvent.click(modal.getByRole('button', { name: /Sumar uno/ }));
    await userEvent.click(modal.getByRole('button', { name: /Sumar uno/ }));
    expect(modal.getByText('5 personas × $11.000')).toBeInTheDocument();
    expect(modal.getByText('= $55.000')).toBeInTheDocument();
    await userEvent.click(modal.getByRole('button', { name: 'Guardar cambios' }));

    expect(put).toHaveBeenCalledWith('/almuerzos-invitados/reg-1', {
      cantidad: 5,
      nombre_invitado: 'Proveedores de café',
      fecha_hora: '2026-11-10T12:30',
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar registro' })).not.toBeInTheDocument());
  });

  it('elimina un registro solo después de confirmar', async () => {
    simularApi();
    const del = vi.spyOn(apiClient, 'delete').mockResolvedValue(respuesta({ message: 'ok' }));
    renderConProveedores(<AlmuerzosInvitadosSection />);

    const fila = (await screen.findByText('Proveedores de café')).closest('tr')!;
    await userEvent.click(within(fila).getByRole('button', { name: 'Eliminar registro' }));
    const dialogo = within(await screen.findByRole('alertdialog', { name: '¿Eliminar este registro?' }));
    expect(dialogo.getByText(/3 personas/)).toBeInTheDocument();

    await userEvent.click(dialogo.getByRole('button', { name: 'Cancelar' }));
    expect(del).not.toHaveBeenCalled();

    await userEvent.click(within(fila).getByRole('button', { name: 'Eliminar registro' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }));
    expect(del).toHaveBeenCalledWith('/almuerzos-invitados/reg-1');
  });
});
