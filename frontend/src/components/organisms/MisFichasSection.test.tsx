import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MisFichasSection } from './MisFichasSection';
import { agruparPorMes } from '../../lib/historial';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta } from '../../test/utils';
import type { Consumo, EstadoPago } from '../../types/api';

const consumo = (id: string, menu_fecha: string, precio: number, estado_pago: EstadoPago = 'pagado'): Consumo => ({
  id,
  fecha: `${menu_fecha}T12:00:00`,
  menu_fecha,
  date: menu_fecha,
  title: `Menú ${id}`,
  precio,
  price: `$${precio}`,
  paymentStatus: estado_pago === 'pendiente' ? 'PENDIENTE' : estado_pago === 'gratis' ? 'GRATIS' : 'PAGADO',
  estado_pago,
  status: 'CONSUMED',
});

describe('agruparPorMes', () => {
  it('agrupa por el mes del menú, del más reciente al más antiguo, con el total de cada mes', () => {
    const meses = agruparPorMes([
      consumo('a', '2026-10-03', 5000),
      consumo('b', '2026-11-20', 5000),
      consumo('c', '2026-11-02', 4000),
      consumo('d', '2026-09-15', 5000),
    ]);

    expect(meses.map((m) => m.clave)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(meses[0].nombre).toBe('Noviembre de 2026');
    expect(meses[0].consumos.map((c) => c.id)).toEqual(['b', 'c']);
    expect(meses[0].total).toBe(9000);
  });
});

describe('MisFichasSection', () => {
  const HISTORIAL = [
    consumo('1', '2026-11-20', 5000, 'pendiente'),
    consumo('2', '2026-11-19', 5000),
    consumo('3', '2026-10-10', 5000),
    consumo('4', '2026-09-10', 5000),
    consumo('5', '2026-08-10', 5000, 'pendiente'),
  ];

  it('muestra los dos meses más recientes y carga los anteriores con un botón', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(HISTORIAL));
    renderConProveedores(<MisFichasSection />);

    expect(await screen.findByRole('region', { name: 'Noviembre de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Octubre de 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Septiembre de 2026' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ver meses anteriores/ }));
    expect(screen.getByRole('region', { name: 'Septiembre de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Agosto de 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver meses anteriores/ })).not.toBeInTheDocument();
  });

  it('"Por pagar" deja solo los almuerzos pendientes de pago', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(HISTORIAL));
    renderConProveedores(<MisFichasSection />);

    await userEvent.click(await screen.findByRole('radio', { name: 'Por pagar (2)' }));

    const noviembre = within(screen.getByRole('region', { name: 'Noviembre de 2026' }));
    expect(noviembre.getByText('Menú 1')).toBeInTheDocument();
    expect(noviembre.queryByText('Menú 2')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Agosto de 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Octubre de 2026' })).not.toBeInTheDocument();
  });
});
