import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlmuerzosEspecialesSection } from './AlmuerzosEspecialesSection';
import { apiClient } from '../../lib/api';
import { hoyBogota } from '../../lib/formato';
import { elegirOpcion, renderConProveedores, respuesta } from '../../test/utils';
import type { AlmuerzoEspecial } from '../../types/api';

const pedido = (cambios: Partial<AlmuerzoEspecial>): AlmuerzoEspecial => ({
  id: 'esp-1',
  solicitante: 'Bienestar al Aprendiz',
  responsable: 'Coordinadora de Bienestar',
  numero_contrato: 'CT-2026-118',
  fecha: hoyBogota(),
  cantidad_personas: 8,
  menu_descripcion: 'Lomo en salsa de champiñones',
  receta_id: 'rec-1',
  receta_nombre: 'Plato ejecutivo',
  precio_unitario: 18000,
  total: 144000,
  estado: 'programado',
  pagado: false,
  fecha_hora_entrega: null,
  fecha_hora_pago: null,
  observaciones: null,
  created_at: '2026-11-20T15:00:00.000Z',
  ...cambios,
});

const PEDIDOS = [
  pedido({}),
  pedido({ id: 'esp-2', solicitante: 'Dirección General', estado: 'entregado', total: 90000, cantidad_personas: 5 }),
];

const DATOS: Record<string, unknown> = {
  '/almuerzos-especiales': PEDIDOS,
  '/almuerzos-especiales/resumen': { porCobrar: { cantidad: 1, monto: 90000 }, programados: 1, cobradoMes: 0 },
  '/menus/recetas': [{ id: 'rec-1', codigo: 'REC-1', nombre: 'Plato ejecutivo', ingredientes: 2 }],
};

const simularApi = () => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => respuesta(DATOS[url]));
  const post = vi.spyOn(apiClient, 'post').mockImplementation(async (_url, body) => respuesta(pedido(body as Partial<AlmuerzoEspecial>)));
  const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue(respuesta({ ...PEDIDOS[0], estado: 'entregado', avisos_inventario: [] }));
  return { post, patch };
};

describe('Almuerzos especiales (Encargado)', () => {
  it('muestra lo que falta cobrar y separa los pedidos programados de los que están por cobrar', async () => {
    simularApi();
    renderConProveedores(<AlmuerzosEspecialesSection />);

    const resumen = within(await screen.findByLabelText('Resumen de almuerzos especiales'));
    expect(await resumen.findByText('$90.000')).toBeInTheDocument();
    expect(resumen.getByText('1 pedido entregado sin pagar')).toBeInTheDocument();

    const programados = within(await screen.findByRole('tabpanel'));
    expect(await programados.findByText('Bienestar al Aprendiz')).toBeInTheDocument();
    expect(programados.queryByText('Dirección General')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Por cobrar/ }));
    const porCobrar = within(await screen.findByRole('tabpanel'));
    expect(await porCobrar.findByText('Dirección General')).toBeInTheDocument();
    expect(porCobrar.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
  });

  it('registra un pedido con su contrato, receta y precio, y muestra el total antes de enviarlo', async () => {
    const { post } = simularApi();
    renderConProveedores(<AlmuerzosEspecialesSection />);

    await userEvent.type(await screen.findByLabelText(/Responsable/), 'Jefe de Bienestar');
    await userEvent.type(screen.getByLabelText(/Contrato u orden/), 'CT-77');
    await userEvent.type(screen.getByLabelText(/Personas/), '12');
    await userEvent.type(screen.getByLabelText(/Qué se va a servir/), 'Pescado al ajillo y postre');
    await userEvent.type(screen.getByLabelText(/Precio por persona/), '20000');
    await elegirOpcion(/Receta/, 'Plato ejecutivo');
    expect(screen.getByText('$240.000')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/almuerzos-especiales', {
        solicitante: 'Bienestar al Aprendiz',
        responsable: 'Jefe de Bienestar',
        numero_contrato: 'CT-77',
        fecha: hoyBogota(),
        cantidad_personas: 12,
        menu_descripcion: 'Pescado al ajillo y postre',
        receta_id: 'rec-1',
        precio_unitario: 20000,
      })
    );
  });

  it('con "Otra dependencia" pide el nombre antes de registrar', async () => {
    const { post } = simularApi();
    renderConProveedores(<AlmuerzosEspecialesSection />);

    await elegirOpcion(/Quién lo pide/, 'Otra dependencia');
    await userEvent.type(screen.getByLabelText(/Responsable/), 'Ana');
    await userEvent.type(screen.getByLabelText(/Personas/), '3');
    await userEvent.type(screen.getByLabelText(/Qué se va a servir/), 'Bandeja especial');
    await userEvent.type(screen.getByLabelText(/Precio por persona/), '15000');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));

    expect(await screen.findByText('Escribe el nombre de la dependencia')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('marcar entregado pide confirmación y avisa que se descuentan los ingredientes de la receta', async () => {
    const { patch } = simularApi();
    renderConProveedores(<AlmuerzosEspecialesSection />);

    await userEvent.click(await screen.findByRole('button', { name: 'Marcar entregado' }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent('ingredientes de "Plato ejecutivo" para 8 personas');

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Marcar entregado' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/almuerzos-especiales/esp-1/entregado'));
  });
});
