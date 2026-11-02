import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservaAlmuerzoCard } from './ReservaAlmuerzoCard';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta, usuarioDePrueba } from '../../test/utils';
import type { MenuActivo } from '../../types/api';

const MENU_ID = '11111111-1111-1111-1111-111111111111';

const menu = (overrides: Partial<MenuActivo> = {}): MenuActivo => ({
  id: MENU_ID,
  fecha: '2026-11-02',
  nombre: 'Bandeja Huilense',
  descripcion: 'Sopa, arroz, proteína y jugo',
  precio_aprendiz: 5000,
  precio_invitado: 8000,
  cantidad_disponible: 100,
  cantidad_vendida: 10,
  imagen_url: '/cafeteria-bg.jpg',
  estado: 'activo',
  precio_aplicable: 5000,
  es_beneficiario: false,
  mi_reserva: null,
  horario: { abre: '07:00', cierra: '21:00', abierto: true },
  reservable: true,
  motivo_no_reservable: null,
  ...overrides,
});

const reservaCreada = (precio: number, estado_pago: 'pendiente' | 'gratis') => ({
  id: 'venta-1',
  fecha: '2026-11-02T17:00:00.000Z',
  date: '2 nov 2026',
  title: 'Bandeja Huilense',
  precio,
  price: precio === 0 ? '$0' : '$5.000',
  paymentStatus: estado_pago === 'gratis' ? 'GRATIS' : 'PENDIENTE',
  estado_pago,
  status: 'RESERVED',
  message: 'ok',
});

const renderTarjeta = (es_beneficiario: boolean) =>
  renderConProveedores(
    <ReservaAlmuerzoCard
      user={usuarioDePrueba({ role: 'aprendiz', es_beneficiario })}
      tituloConfirmacion="Confirmar Reserva de Almuerzo"
      detalleConfirmacion={(precio) => <p>Valor {precio}</p>}
      mensajeExito={(r) => `Tarifa ${r.price}`}
    />
  );

describe('Reserva de almuerzo del aprendiz', () => {
  it('el beneficiario ve $0 y reserva con un solo clic, sin modal', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu({ precio_aplicable: 0, es_beneficiario: true })));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta(reservaCreada(0, 'gratis')));
    renderTarjeta(true);

    expect(await screen.findByText('$0')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Reservar Almuerzo \(Gratis\)/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/consumos/reservar', { menu_id: MENU_ID });
    expect(await screen.findByText('¡Almuerzo reservado con éxito!')).toBeInTheDocument();
  });

  it('el aprendiz regular confirma en un modal de $5.000 antes de reservar', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu()));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta(reservaCreada(5000, 'pendiente')));
    renderTarjeta(false);

    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar Almuerzo' }));
    const dialogo = screen.getByRole('dialog', { name: 'Confirmar Reserva de Almuerzo' });
    expect(within(dialogo).getByText('Valor $5.000')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole('button', { name: /Confirmar/ }));
    // El frontend nunca envía el precio: lo fija el backend
    expect(post).toHaveBeenCalledWith('/consumos/reservar', { menu_id: MENU_ID });
  });

  it('muestra la reserva existente con su estado de pago en lugar del botón', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      respuesta(menu({ mi_reserva: { id: 'v', estado_pago: 'pagado', precio: 5000 }, reservable: false }))
    );
    renderTarjeta(false);

    expect(await screen.findByText('Almuerzo reservado')).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar Almuerzo' })).not.toBeInTheDocument();
  });

  it('fuera de horario deshabilita el botón y explica el motivo', async () => {
    const motivo = 'Las reservas de almuerzo solo se reciben de 7:00 a. m. a 9:00 p. m. (hora de Colombia).';
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      respuesta(menu({ reservable: false, motivo_no_reservable: motivo, horario: { abre: '07:00', cierra: '21:00', abierto: false } }))
    );
    renderTarjeta(false);

    expect(await screen.findByRole('button', { name: 'Solicitar Almuerzo' })).toBeDisabled();
    expect(screen.getByText(motivo)).toBeInTheDocument();
  });
});
