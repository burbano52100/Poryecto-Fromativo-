import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuDelDiaEncargadoSection } from './MenuDelDiaEncargadoSection';
import { apiClient } from '../../lib/api';
import { elegirOpcion, renderConProveedores, respuesta } from '../../test/utils';

const ingrediente = (material_id: string, item: string, cantidad: number) => ({
  material_id,
  item,
  cantidad,
  unidad: 'Kg',
  quantity: `${cantidad} Kg`,
  cost: 0,
});

const DATOS: Record<string, unknown> = {
  '/menus': [],
  '/menus/recetas': [{ id: 'rec-1', codigo: 'REC-001', nombre: 'Bandeja con pollo sudado', ingredientes: 2 }],
  '/menus/sugerencia': {
    fecha: '2026-11-24',
    dia_semana: 'martes',
    sugerencia: 80,
    suficiente: true,
    mensaje: 'Sugerencia: preparar 80 almuerzos (promedio de los últimos 4 martes: 72,5)',
  },
  '/inventario/recetas': [
    {
      id: 'rec-1',
      code: 'REC-001',
      name: 'Bandeja con pollo sudado',
      cost: 0,
      price: 0,
      margen: 0,
      margen_pct: null,
      ingredients: [ingrediente('mat-arroz', 'Arroz', 0.15), ingrediente('mat-pollo', 'Pechuga de pollo', 0.25)],
    },
  ],
  '/inventario/materiales': [
    { id: 'mat-arroz', name: 'Arroz', unit: 'Kg', stock: 44.85 },
    { id: 'mat-pollo', name: 'Pechuga de pollo', unit: 'Kg', stock: 27.75 },
  ],
};

const simularApi = () => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => respuesta(DATOS[url]));
  return vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta({ message: 'ok' }));
};

const tablaDeIngredientes = () => within(screen.getByRole('table', { name: /Bandeja con pollo sudado/ }));

describe('Menú del día (Encargado): receta e ingredientes', () => {
  it('sin receta avisa que los almuerzos no descontarán inventario', async () => {
    simularApi();
    renderConProveedores(<MenuDelDiaEncargadoSection />);

    expect(await screen.findByText(/no descuentan ingredientes del inventario/)).toBeInTheDocument();
  });

  it('al elegir la receta muestra cuánto se necesita para las porciones y qué falta en bodega', async () => {
    simularApi();
    renderConProveedores(<MenuDelDiaEncargadoSection />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Receta/ })).toBeInTheDocument());
    await elegirOpcion(/Receta/, 'Bandeja con pollo sudado (2 ingredientes)');

    // 200 porciones: 30 kg de arroz (hay 44,85) y 50 kg de pollo (hay 27,75)
    const arroz = within(await screen.findByRole('rowheader', { name: 'Arroz' }).then((c) => c.closest('tr')!));
    expect(arroz.getByText('30 Kg')).toBeInTheDocument();
    const pollo = tablaDeIngredientes().getByRole('rowheader', { name: 'Pechuga de pollo' }).closest('tr')!;
    expect(pollo).toHaveTextContent('50 Kg');
    expect(pollo).toHaveTextContent('faltan 22,25');
    expect(screen.getByText('Falta 1 ingrediente para 200 porciones')).toBeInTheDocument();
  });

  it('"Usar la sugerencia" pone las porciones sugeridas y se publica con la receta elegida', async () => {
    const post = simularApi();
    renderConProveedores(<MenuDelDiaEncargadoSection />);

    await userEvent.click(await screen.findByRole('button', { name: 'Usar 80 porciones' }));
    expect(screen.getByLabelText(/Porciones disponibles/)).toHaveValue('80');

    await elegirOpcion(/Receta/, 'Bandeja con pollo sudado (2 ingredientes)');
    expect(await screen.findByText('Alcanza para 80 porciones')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar y publicar' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/menus', expect.objectContaining({ cantidad_disponible: 80, receta_id: 'rec-1' }))
    );
  });

  it('publicar sin receta envía receta_id null', async () => {
    const post = simularApi();
    renderConProveedores(<MenuDelDiaEncargadoSection />);

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar y publicar' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/menus', expect.objectContaining({ receta_id: null })));
  });
});
