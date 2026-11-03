import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockView } from './StockView';
import { apiClient } from '../../../lib/api';
import { renderConProveedores, respuesta } from '../../../test/utils';
import type { Material } from '../../../types/api';

const ACEITE: Material = {
  id: 'mat-1',
  code: 'ACE-01',
  name: 'Aceite Vegetal Gourmet 1L',
  category: 'Aceites',
  unit: 'Litros',
  expiry: null,
  expiry_iso: null,
  stock: 11,
  stock_minimo: 2,
  costo: 12000,
  estado: 'Bueno',
};

describe('Salida de un material', () => {
  it('la cantidad no acepta letras y se envía como número', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta([ACEITE]));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta({ message: 'ok' }));
    renderConProveedores(<StockView />);

    await userEvent.click(await screen.findByRole('button', { name: `Registrar salida de ${ACEITE.name}` }));
    const cantidad = screen.getByLabelText(/Cantidad \(Litros\)/);
    await userEvent.type(cantidad, 'n2,5L');
    expect(cantidad).toHaveValue('2.5');

    await userEvent.click(screen.getByRole('button', { name: 'Registrar Salida' }));

    expect(post).toHaveBeenCalledWith('/inventario/materiales/mat-1/salidas', {
      cantidad: 2.5,
      concepto: 'Preparación de almuerzos',
    });
  });
});
