import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservaAlmuerzoCard } from './ReservaAlmuerzoCard';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta, usuarioDePrueba } from '../../test/utils';
import type { MenuActivo, ResultadoComprobante } from '../../types/api';

const MENU_ID = '11111111-1111-1111-1111-111111111111';
const enQuinceMinutos = () => new Date(Date.now() + 15 * 60_000).toISOString();

const menu = (overrides: Partial<MenuActivo> = {}): MenuActivo => ({
  id: MENU_ID,
  fecha: '2026-11-02',
  nombre: 'Bandeja Huilense',
  descripcion: 'Sopa, arroz, proteína y jugo',
  precio_aprendiz: 5000,
  precio_instructor: 10000,
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
  metodo_pago: estado_pago === 'gratis' ? 'cortesia' : 'qr',
  vence_en: estado_pago === 'gratis' ? null : enQuinceMinutos(),
  minutos_para_pagar: estado_pago === 'gratis' ? null : 15,
  status: 'RESERVED',
  message: 'ok',
});

const resultado = (estado: ResultadoComprobante['estado'], motivo: string): ResultadoComprobante => ({
  id: 'comprobante-1',
  estado,
  motivo,
  lectura: { banco: 'Nequi', valor: 5000, fecha: '2026-11-02', hora: '12:31', numero: 'M8392017' },
  reserva: {
    id: 'venta-1',
    estado_pago: estado === 'aceptado' ? 'pagado' : 'pendiente',
    vence_en: estado === 'rechazado' ? enQuinceMinutos() : null,
  },
});

/** El POST de la reserva devuelve `reserva`; el del comprobante, `comprobante`. */
const mockPost = (reserva: object, comprobante?: ResultadoComprobante) =>
  vi
    .spyOn(apiClient, 'post')
    .mockImplementation(async (url: string) => respuesta(url === '/consumos/reservar' ? reserva : comprobante));

const renderTarjeta = (overrides: Parameters<typeof usuarioDePrueba>[0] = {}, permitirFiar = false) =>
  renderConProveedores(
    <ReservaAlmuerzoCard user={usuarioDePrueba({ role: 'aprendiz', ...overrides })} permitirFiar={permitirFiar} />
  );

const captura = (tipo = 'image/png') => new File(['captura'], 'comprobante.png', { type: tipo });

describe('Reserva y pago del almuerzo con el código QR (ADR 027)', () => {
  it('al solicitar aparta la porción y abre el chat con el código QR y el tiempo que queda', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu()));
    const post = mockPost(reservaCreada(5000, 'pendiente'));
    renderTarjeta();

    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar almuerzo' }));
    // El frontend nunca envía el precio ni una forma de pago: lo fija el backend
    expect(post).toHaveBeenCalledWith('/consumos/reservar', { menu_id: MENU_ID });

    const chat = await screen.findByRole('dialog', { name: 'Pagar el almuerzo con el código QR' });
    expect(within(chat).getByRole('img', { name: /Código QR de Bancolombia/ })).toBeInTheDocument();
    expect(within(chat).getByText(/Apartado \d+:\d{2}/)).toBeInTheDocument();
    expect(within(chat).getByRole('link', { name: /Descargar el código/ })).toHaveAttribute('download');
    expect(within(chat).getByRole('button', { name: /Subir comprobante/ })).toBeInTheDocument();
  });

  it('sube la captura y muestra el pago confirmado', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu()));
    const post = mockPost(
      reservaCreada(5000, 'pendiente'),
      resultado('aceptado', 'Pago de Nequi por $5.000 hoy a las 12:31 p. m., comprobante M8392017.')
    );
    renderTarjeta();

    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar almuerzo' }));
    const chat = await screen.findByRole('dialog', { name: 'Pagar el almuerzo con el código QR' });
    await userEvent.upload(within(chat).getByLabelText('Captura del comprobante'), captura());

    expect(post).toHaveBeenCalledWith(
      '/consumos/venta-1/comprobante',
      expect.any(File),
      expect.objectContaining({ headers: { 'Content-Type': 'image/png' } })
    );
    expect(await within(chat).findByText('Pago confirmado')).toBeInTheDocument();
    expect(within(chat).getByText(/comprobante M8392017/)).toBeInTheDocument();
    expect(within(chat).getByRole('img', { name: 'Tu comprobante' })).toBeInTheDocument();
    expect(within(chat).queryByRole('button', { name: /Subir comprobante/ })).not.toBeInTheDocument();
    expect(within(chat).getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });

  it('si el comprobante no se acepta explica por qué y deja subir otro', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu()));
    mockPost(
      reservaCreada(5000, 'pendiente'),
      resultado('rechazado', 'Este comprobante ya se usó para pagar otra reserva. Cada pago sirve para un solo almuerzo.')
    );
    renderTarjeta();

    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar almuerzo' }));
    const chat = await screen.findByRole('dialog', { name: 'Pagar el almuerzo con el código QR' });
    await userEvent.upload(within(chat).getByLabelText('Captura del comprobante'), captura());

    expect(await within(chat).findByText('No se aceptó')).toBeInTheDocument();
    expect(within(chat).getByText(/ya se usó para pagar otra reserva/)).toBeInTheDocument();
    expect(within(chat).getByRole('button', { name: /Subir comprobante/ })).toBeInTheDocument();
  });

  it('no envía archivos que no son imágenes', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu()));
    const post = mockPost(reservaCreada(5000, 'pendiente'));
    renderTarjeta();

    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar almuerzo' }));
    const chat = await screen.findByRole('dialog', { name: 'Pagar el almuerzo con el código QR' });
    await userEvent.upload(within(chat).getByLabelText('Captura del comprobante'), captura('application/pdf'), {
      applyAccept: false,
    });

    expect(within(chat).getByText(/Sube una imagen PNG, JPG o WEBP/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('el instructor paga su propio precio con el mismo chat', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu({ precio_aplicable: 10000 })));
    const post = mockPost({ ...reservaCreada(10000, 'pendiente'), price: '$10.000' });
    renderTarjeta({ role: 'instructor' });

    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar almuerzo' }));
    expect(post).toHaveBeenCalledWith('/consumos/reservar', { menu_id: MENU_ID });
    const chat = await screen.findByRole('dialog', { name: 'Pagar el almuerzo con el código QR' });
    expect(within(chat).getAllByText('$10.000').length).toBeGreaterThan(0);
  });

  it('una reserva que espera el comprobante muestra "Pagar con QR" y abre el chat', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      respuesta(
        menu({
          reservable: false,
          mi_reserva: { id: 'venta-1', estado_pago: 'pendiente', precio: 5000, metodo_pago: 'qr', vence_en: enQuinceMinutos() },
        })
      )
    );
    renderTarjeta();

    expect(await screen.findByText('Almuerzo apartado')).toBeInTheDocument();
    expect(screen.getByText(/Paga y sube el comprobante antes de las/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Pagar con QR/ }));
    expect(await screen.findByRole('dialog', { name: 'Pagar el almuerzo con el código QR' })).toBeInTheDocument();
  });

  it('con el comprobante en revisión no deja subir otro', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      respuesta(
        menu({
          reservable: false,
          mi_reserva: {
            id: 'venta-1',
            estado_pago: 'pendiente',
            precio: 5000,
            metodo_pago: 'qr',
            vence_en: null,
            comprobante: { estado: 'en_revision', motivo: 'No pude confirmar el número del comprobante.' },
          },
        })
      )
    );
    renderTarjeta();

    expect(await screen.findByText('Comprobante en revisión')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ver el pago/ }));
    const chat = await screen.findByRole('dialog', { name: 'Pagar el almuerzo con el código QR' });
    expect(within(chat).getByText(/está en revisión del encargado/)).toBeInTheDocument();
    expect(within(chat).queryByRole('button', { name: /Subir comprobante/ })).not.toBeInTheDocument();
  });
});

describe('Reserva de almuerzo del aprendiz', () => {
  it('el beneficiario ve $0 y reserva con un solo clic, sin pagar', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu({ precio_aplicable: 0, es_beneficiario: true })));
    const post = mockPost(reservaCreada(0, 'gratis'));
    renderTarjeta({ es_beneficiario: true });

    expect(await screen.findByText('$0')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Reservar almuerzo gratis/ }));

    expect(post).toHaveBeenCalledWith('/consumos/reservar', { menu_id: MENU_ID });
    expect(await screen.findByText('Almuerzo reservado')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra la reserva pagada con su estado en lugar del botón', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      respuesta(menu({ mi_reserva: { id: 'v', estado_pago: 'pagado', precio: 5000, metodo_pago: 'qr' }, reservable: false }))
    );
    renderTarjeta();

    expect(await screen.findByText('Almuerzo reservado')).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar almuerzo' })).not.toBeInTheDocument();
  });

  it('fuera de horario deshabilita el botón y explica el motivo', async () => {
    const motivo = 'Las reservas de almuerzo solo se reciben de 7:00 a. m. a 9:00 p. m. (hora de Colombia).';
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      respuesta(menu({ reservable: false, motivo_no_reservable: motivo, horario: { abre: '07:00', cierra: '21:00', abierto: false } }))
    );
    renderTarjeta();

    expect(await screen.findByRole('button', { name: 'Solicitar almuerzo' })).toBeDisabled();
    expect(screen.getByText(motivo)).toBeInTheDocument();
  });
});

describe('El instructor puede fiar el almuerzo (ADR 028)', () => {
  it('"Fiar" reserva de una vez, sin el QR, y avisa que se sumó a la cuenta del mes', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu({ precio_aplicable: 10000 })));
    const post = mockPost({
      ...reservaCreada(10000, 'pendiente'),
      price: '$10.000',
      metodo_pago: 'credito',
      fiado: true,
      vence_en: null,
      minutos_para_pagar: null,
    });
    renderTarjeta({ role: 'instructor' }, true);

    await userEvent.click(await screen.findByRole('button', { name: /Fiar/ }));
    expect(post).toHaveBeenCalledWith('/consumos/reservar', { menu_id: MENU_ID, forma_pago: 'fiado' });
    expect(await screen.findByText(/Fiado: \$10\.000 se sumó a tu cuenta del mes/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('el aprendiz no ve "Fiar"', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(menu()));
    renderTarjeta({}, false);
    expect(await screen.findByRole('button', { name: 'Solicitar almuerzo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fiar/ })).not.toBeInTheDocument();
  });

  it('una reserva fiada se muestra como fiado, sin botón de pago', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      respuesta(
        menu({
          reservable: false,
          precio_aplicable: 10000,
          mi_reserva: { id: 'venta-1', estado_pago: 'pendiente', precio: 10000, metodo_pago: 'credito', vence_en: null },
        })
      )
    );
    renderTarjeta({ role: 'instructor' }, true);

    expect(await screen.findByText('Almuerzo reservado')).toBeInTheDocument();
    expect(screen.getByText('Fiado')).toBeInTheDocument();
    expect(screen.getByText('Se paga a fin de mes en la oficina del comedor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pagar con QR/ })).not.toBeInTheDocument();
  });
});
