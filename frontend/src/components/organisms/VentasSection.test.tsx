import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { VentasSection } from './VentasSection';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta } from '../../test/utils';
import type { ReporteVentas } from '../../types/api';

const REPORTE: ReporteVentas = {
  period: 'semana',
  desde: '2026-11-16',
  agrupacion: 'dia',
  totales: {
    almuerzosServidos: 5,
    almuerzosGratis: 1,
    ingresosCobrados: 37000,
    porCobrar: 0,
    almuerzosInvitados: 3,
    ingresosInvitados: 32000,
    invitadosPorTipo: {
      instructor: { personas: 1, ingresos: 10000 },
      aprendiz: { personas: 0, ingresos: 0 },
      corriente: { personas: 2, ingresos: 22000 },
    },
  },
  breakdown: [{ fecha: '2026-11-16', label: 'lun, 16', count: 5, ingresos: 37000, invitados: 3, percent: 100 }],
  transacciones: [
    {
      id: 'inv-1',
      fecha: '2026-11-16T17:40:00.000Z',
      cliente: 'Proveedor',
      cedula: '',
      rol: 'corriente',
      ficha: '',
      menu: 'Almuerzo invitado',
      precio: 22000,
      estado_pago: 'pagado',
      beneficiario: false,
      origen: 'invitado',
      personas: 2,
    },
    {
      id: 'ven-1',
      fecha: '2026-11-16T17:00:00.000Z',
      cliente: 'Ana Aprendiz',
      cedula: '1005678901',
      rol: 'aprendiz',
      ficha: '2847251',
      menu: 'Menú Ejecutivo SENA',
      precio: 5000,
      estado_pago: 'pagado',
      beneficiario: false,
      origen: 'reserva',
      personas: 1,
    },
  ],
};

describe('Ventas del Encargado con Almuerzos invitados', () => {
  it('suma los invitados en las tarjetas y los distingue por tipo', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(REPORTE));
    renderConProveedores(<VentasSection />);

    expect(await screen.findByText(/Incluye 1 gratis de beneficiarios y 3 de invitados/)).toBeInTheDocument();
    expect(screen.getByText('$37.000')).toBeInTheDocument();
    expect(screen.getByText(/Reservas pagadas y \$32\.000 de invitados/)).toBeInTheDocument();

    // Cada tipo es una cifra de la franja: etiqueta, total cobrado y personas
    const invitados = within(screen.getByRole('region', { name: 'Almuerzos invitados del período' }));
    const cifra = (tipo: string) => invitados.getByText(tipo).closest('div')!;
    expect(cifra('Instructores')).toHaveTextContent('$10.000');
    expect(cifra('Instructores')).toHaveTextContent('1 persona');
    expect(cifra('Aprendices')).toHaveTextContent('$0');
    expect(cifra('Aprendices')).toHaveTextContent('0 personas');
    expect(cifra('Corrientes')).toHaveTextContent('$22.000');
    expect(cifra('Corrientes')).toHaveTextContent('2 personas');
    expect(screen.getByText(/5 almuerzos \(3 invitados\)/)).toBeInTheDocument();
  });

  it('en las transacciones un almuerzo invitado muestra su tipo y el número de personas', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(REPORTE));
    renderConProveedores(<VentasSection />);

    const filaInvitado = (await screen.findByText('Invitado · Corrientes')).closest('tr')!;
    expect(filaInvitado).toHaveTextContent('Proveedor');
    expect(filaInvitado).toHaveTextContent('2 personas');
    expect(filaInvitado).toHaveTextContent('$22.000');
    expect(filaInvitado).not.toHaveTextContent('C.C.');

    const filaReserva = screen.getByText('Ana Aprendiz').closest('tr')!;
    expect(filaReserva).toHaveTextContent('C.C. 1005678901');
    expect(filaReserva).toHaveTextContent('Aprendiz');
  });
});
