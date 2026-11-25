import { describe, expect, it } from 'vitest';
import {
  analizarComprobante,
  decidir,
  tipoDeImagen,
  type ContextoDecision,
} from '../services/lectorComprobantes.service.js';

// Textos tal como los devolvió Tesseract (español) al leer capturas de 1080 px de cada app
const BANCOLOMBIA = `Bancolombia

¡Pago exitoso!

25 nov. 2026 - 12:31 p.m.

Comprobante No. 0000085123
Producto origen Ahorros *4521
Pagaste a CENTR GEST SURCOLOM
Valor del pago $5.000,00
Costo de la transacción $0,00`;

const NEQUI = `Nequi

¡Pago con QR exitoso!
Para

CENTR GEST SURCOLOM
¿Cuánto?

$ 10.000,00

Fecha

25 de noviembre de 2026 a las 12:40 p. m.
Referencia

M8392017

Disponible

$ 120.350,00`;

const DAVIPLATA = `DaviPlata

Pago con QR exitoso
Comercio: CENTR GEST SURCOLOM
Valor: $5.000

Fecha: 25/11/2026 12:45

Número de aprobación: 482913`;

const HOY = '2026-11-25';
const contexto = (extra: Partial<ContextoDecision> = {}): ContextoDecision => ({
  hoy: HOY,
  valorEsperado: 5000,
  confianza: 92,
  reservaEn: new Date('2026-11-25T12:25:00-05:00'),
  ahora: new Date('2026-11-25T12:50:00-05:00'),
  ...extra,
});

describe('analizarComprobante', () => {
  it('lee un comprobante de Bancolombia', () => {
    const a = analizarComprobante(BANCOLOMBIA, HOY);
    expect(a).toEqual({
      banco: 'Bancolombia',
      numero: '0000085123',
      valores: [5000],
      fechas: [HOY],
      hora: '12:31',
      destinatario: true,
    });
  });

  it('lee Nequi sin confundir el saldo disponible con el valor pagado', () => {
    const a = analizarComprobante(NEQUI, HOY);
    expect(a.banco).toBe('Nequi');
    expect(a.numero).toBe('M8392017');
    expect(a.valores).toEqual([10000]);
    expect(a.fechas).toEqual([HOY]);
    expect(a.hora).toBe('12:40');
    expect(a.destinatario).toBe(true);
  });

  it('lee Daviplata con fecha numérica y hora de 24 horas', () => {
    const a = analizarComprobante(DAVIPLATA, HOY);
    expect(a).toMatchObject({ banco: 'Daviplata', numero: '482913', valores: [5000], fechas: [HOY], hora: '12:45' });
  });

  it('toma la hora que va con la fecha, no la del reloj del celular', () => {
    const a = analizarComprobante(`9:58\n${BANCOLOMBIA}`, HOY);
    expect(a.hora).toBe('12:31');
  });

  it('no deja que un costo en la línea anterior tape el valor con etiqueta propia', () => {
    const a = analizarComprobante('Costo de la transacción $0,00\nComisión $400\nValor del pago $5.000', HOY);
    expect(a.valores).toEqual([5000]);
  });

  it('corrige confusiones del OCR en el número y en el destinatario', () => {
    const a = analizarComprobante('Bancolombia\nComprobante No. OOOO851I3\nPagaste a CENTR GEST SURC0LOM', HOY);
    expect(a.numero).toBe('000085113');
    expect(a.destinatario).toBe(true);
  });

  it('entiende "Hoy" cuando la app no escribe la fecha', () => {
    expect(analizarComprobante('Nequi\nHoy, 12:40 p. m.\n$5.000', HOY).fechas).toEqual([HOY]);
  });
});

describe('decidir', () => {
  it('acepta un comprobante completo de hoy por el valor del almuerzo', () => {
    const d = decidir(analizarComprobante(BANCOLOMBIA, HOY), contexto());
    expect(d.estado).toBe('aceptado');
    expect(d.motivo).toContain('Bancolombia');
    expect(d.motivo).toContain('0000085123');
  });

  it('acepta el pago del instructor por su propio precio', () => {
    expect(decidir(analizarComprobante(NEQUI, HOY), contexto({ valorEsperado: 10000 })).estado).toBe('aceptado');
  });

  it('rechaza un comprobante de otro día', () => {
    const ayer = BANCOLOMBIA.replace('25 nov. 2026', '24 nov. 2026');
    const d = decidir(analizarComprobante(ayer, HOY), contexto());
    expect(d.estado).toBe('rechazado');
    expect(d.motivo).toContain('24 de noviembre de 2026');
  });

  it('rechaza un valor distinto al del almuerzo', () => {
    const d = decidir(analizarComprobante(NEQUI, HOY), contexto({ valorEsperado: 5000 }));
    expect(d.estado).toBe('rechazado');
    expect(d.motivo).toContain('$10.000');
  });

  it('rechaza un pago de hoy hecho más de una hora antes de la reserva', () => {
    const d = decidir(analizarComprobante(BANCOLOMBIA, HOY), contexto({ reservaEn: new Date('2026-11-25T14:00:00-05:00') }));
    expect(d.estado).toBe('rechazado');
    expect(d.motivo).toContain('12:31 p. m.');
  });

  it('manda a revisión un pago con hora posterior a la actual', () => {
    const d = decidir(analizarComprobante(BANCOLOMBIA, HOY), contexto({ ahora: new Date('2026-11-25T12:00:00-05:00') }));
    expect(d.estado).toBe('en_revision');
  });

  it('manda a revisión si falta el número o el destinatario', () => {
    const sinNumero = BANCOLOMBIA.replace('Comprobante No. 0000085123', '');
    const d1 = decidir(analizarComprobante(sinNumero, HOY), contexto());
    expect(d1.estado).toBe('en_revision');
    expect(d1.motivo).toContain('el número del comprobante');

    const otroDestino = BANCOLOMBIA.replace('CENTR GEST SURCOLOM', 'TIENDA DON PEPE');
    const d2 = decidir(analizarComprobante(otroDestino, HOY), contexto());
    expect(d2.estado).toBe('en_revision');
    expect(d2.motivo).toContain('Centro de Gestión');
  });

  it('manda a revisión una imagen poco nítida aunque tenga todos los datos', () => {
    expect(decidir(analizarComprobante(BANCOLOMBIA, HOY), contexto({ confianza: 41 })).estado).toBe('en_revision');
  });

  it('rechaza una imagen que no es un comprobante', () => {
    const d = decidir(analizarComprobante('Foto del almuerzo\nArroz con pollo', HOY), contexto());
    expect(d.estado).toBe('rechazado');
    expect(d.motivo).toContain('captura de pantalla');
  });
});

describe('tipoDeImagen', () => {
  it('reconoce PNG, JPEG y WEBP por sus primeros bytes', () => {
    expect(tipoDeImagen(Buffer.from('89504e470d0a1a0a0000000d', 'hex'))).toBe('image/png');
    expect(tipoDeImagen(Buffer.from('ffd8ffe000104a4649460001', 'hex'))).toBe('image/jpeg');
    expect(tipoDeImagen(Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1'))).toBe('image/webp');
    expect(tipoDeImagen(Buffer.from('%PDF-1.7 hola mundo'))).toBeNull();
  });
});
