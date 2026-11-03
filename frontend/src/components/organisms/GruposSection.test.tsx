import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GruposSection } from './GruposSection';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta } from '../../test/utils';
import type { AprendicesDeGrupo, Grupo } from '../../types/api';

const GRUPO: Grupo = {
  id: 'grupo-1',
  ficha: '2847251',
  program: 'Análisis y Desarrollo de Software',
  shift: 'Mañana',
  instructor: 'Instructora Paula',
  studentsCount: 30,
  reservasHoy: 2,
  pendientesHoy: 1,
  pagadosHoy: 0,
  gratisHoy: 1,
};

const APRENDICES: AprendicesDeGrupo = {
  ficha: { id: 'grupo-1', codigo_ficha: '2847251', programa: 'ADSO' },
  aprendices: [
    {
      id: 'a1', name: 'Ana Beneficiaria', document: '1001', email: null, es_beneficiario: true,
      venta_id: 'venta-ana', precio: 0, estado_pago: 'gratis', fecha_hora: '2026-11-02T17:00:00Z',
    },
    {
      id: 'a2', name: 'Carlos Normal', document: '1002', email: null, es_beneficiario: false,
      venta_id: 'venta-carlos', precio: 5000, estado_pago: 'pendiente', fecha_hora: '2026-11-02T17:05:00Z',
    },
  ],
};

describe('Grupos del Encargado', () => {
  it('al tocar la tarjeta despliega los aprendices de hoy y permite marcar Pagado', async () => {
    const get = vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) =>
      respuesta(url === '/grupos' ? [GRUPO] : APRENDICES)
    );
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue(respuesta({ estado_pago: 'pagado' }));
    renderConProveedores(<GruposSection />);

    const tarjeta = await screen.findByRole('button', { name: /Ficha 2847251/ });
    expect(tarjeta).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(tarjeta);
    expect(tarjeta).toHaveAttribute('aria-expanded', 'true');
    expect(get).toHaveBeenCalledWith('/grupos/grupo-1/aprendices');

    // La beneficiaria aparece como Gratis, sin botones de pago
    expect(await screen.findByText('Ana Beneficiaria')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pago de Ana Beneficiaria' })).not.toBeInTheDocument();
    expect(screen.getByText('Gratis')).toBeInTheDocument();

    const pagoCarlos = screen.getByRole('group', { name: 'Pago de Carlos Normal' });
    expect(within(pagoCarlos).getByRole('button', { name: 'No pagado' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(pagoCarlos).getByRole('button', { name: 'Pagado' }));
    expect(patch).toHaveBeenCalledWith('/grupos/ventas/venta-carlos/pago', { pagado: true });
  });

  it('ordena las fichas de la que más reservó hoy a la que menos', async () => {
    const ficha = (id: string, reservasHoy: number, pendientesHoy: number): Grupo => ({
      ...GRUPO,
      id,
      ficha: id,
      program: `Programa ${id}`,
      reservasHoy,
      pendientesHoy,
    });
    // La API las devuelve por número de ficha
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      respuesta([ficha('1001', 0, 0), ficha('1002', 7, 0), ficha('1003', 3, 1), ficha('1004', 7, 2)])
    );
    renderConProveedores(<GruposSection />);

    const lista = await screen.findByRole('list', { name: 'Fichas ordenadas por reservas de hoy' });
    const programas = within(lista)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    // 1004 y 1002 empatan en 7: va primero la que tiene más pendientes de pago
    expect(programas).toEqual(['Programa 1004', 'Programa 1002', 'Programa 1003', 'Programa 1001']);
  });
});
