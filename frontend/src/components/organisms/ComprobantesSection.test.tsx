import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AxiosRequestConfig } from 'axios';
import { ComprobantesSection } from './ComprobantesSection';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta } from '../../test/utils';
import type { ComprobantePago } from '../../types/api';

const comprobante = (overrides: Partial<ComprobantePago> = {}): ComprobantePago => ({
  id: 'c1',
  estado: 'en_revision',
  motivo: 'No pude confirmar el número del comprobante. El encargado revisará tu comprobante y tu almuerzo sigue apartado.',
  banco: 'Bancolombia',
  numero: null,
  valor: 5000,
  fecha_pago: '2026-11-25',
  hora_pago: '12:31',
  destinatario_ok: true,
  confianza: 88,
  subido_en: '2026-11-25T17:32:00.000Z',
  revisado_en: null,
  revisado_por: null,
  tiene_imagen: true,
  persona: { nombre: 'Camila Ortiz', cedula: '1005678910', rol: 'aprendiz', ficha: '3312744' },
  reserva: { id: 'venta-1', precio: 5000, estado: 'completada', estado_pago: 'pendiente', menu: 'Menú Ejecutivo SENA' },
  ...overrides,
});

const mockGet = () =>
  vi.spyOn(apiClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
    if (url === '/comprobantes/resumen') {
      return respuesta({ aceptados_hoy: 3, valor_aceptado_hoy: 20000, rechazados_hoy: 1, en_revision: 1 });
    }
    if (url === '/comprobantes/c1/imagen') return respuesta(new Blob(['png'], { type: 'image/png' }));
    if ((config?.params as { estado?: string } | undefined)?.estado === 'en_revision') return respuesta([comprobante()]);
    return respuesta([
      comprobante(),
      comprobante({
        id: 'c2',
        estado: 'rechazado',
        motivo: 'Este comprobante ya se usó para pagar otra reserva.',
        numero: '0000085123',
        persona: { nombre: 'Jorge Martínez', cedula: '1085432190', rol: 'instructor', ficha: null },
      }),
    ]);
  });

describe('Pagos con QR del encargado (ADR 027)', () => {
  it('muestra primero los comprobantes por revisar con lo que leyó SARA', async () => {
    mockGet();
    renderConProveedores(<ComprobantesSection />);

    expect(await screen.findByText('Comprobantes por revisar')).toBeInTheDocument();
    // Lo leído va al lado de la captura; lo que no se encontró queda marcado
    expect(await screen.findByText('Bancolombia')).toBeInTheDocument();
    expect(screen.getByText('No se leyó')).toBeInTheDocument();
    expect(screen.getByText('Centro de Gestión')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Comprobante de Camila Ortiz' })).toBeInTheDocument();

    const hoy = screen.getByRole('list', { name: 'Comprobantes de hoy' });
    expect(within(hoy).getByText('Jorge Martínez')).toBeInTheDocument();
    expect(within(hoy).getByText('No aceptado')).toBeInTheDocument();
    expect(within(hoy).getByText(/ya se usó para pagar otra reserva/)).toBeInTheDocument();
  });

  it('aprobar deja el almuerzo pagado', async () => {
    mockGet();
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta({ message: 'ok' }));
    renderConProveedores(<ComprobantesSection />);

    await userEvent.click(await screen.findByRole('button', { name: /Aprobar pago/ }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Aprobar pago' });
    await userEvent.click(within(dialogo).getByRole('button', { name: /Aprobar \$5\.000/ }));

    expect(post).toHaveBeenCalledWith('/comprobantes/c1/aprobar', {});
    expect(await screen.findByText(/Pago de Camila Ortiz aprobado/)).toBeInTheDocument();
  });

  it('rechazar exige un motivo', async () => {
    mockGet();
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta({ message: 'ok' }));
    renderConProveedores(<ComprobantesSection />);

    await userEvent.click(await screen.findByRole('button', { name: /^Rechazar$/ }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Rechazar comprobante' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Rechazar' }));
    expect(within(dialogo).getByText(/Escribe el motivo del rechazo/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await userEvent.type(within(dialogo).getByLabelText(/Motivo/), 'La captura está cortada');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Rechazar' }));
    expect(post).toHaveBeenCalledWith('/comprobantes/c1/rechazar', { motivo: 'La captura está cortada' });
  });
});
