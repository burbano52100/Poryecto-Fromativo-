import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearFicha, crearMenu, crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';
import { usarLectorDePrueba } from '../services/lectorComprobantes.service.js';
import { liberarReservasVencidas } from '../services/pagoQr.service.js';

const app = createApp();

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;
let otraAprendiz: UsuarioTest;
let instructor: UsuarioTest;
let beneficiaria: UsuarioTest;

const auth = (u: UsuarioTest) => ({ Authorization: `Bearer ${u.token}` });

/** Una "imagen" PNG distinta en cada llamada: el OCR es de prueba, solo importan los primeros bytes. */
const imagenPng = () => Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), randomBytes(64)]);

/** Lo que "lee" el OCR de prueba en la siguiente imagen. */
let textoLeido = '';
let falloOcr = false;

/** Fecha y hora de PostgreSQL en Colombia: las reservas y la revisión del comprobante usan ese reloj. */
const ahoraBd = async () =>
  (
    await pool.query<{ fecha: string; hora: string }>(
      `SELECT TO_CHAR(NOW() AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY') AS fecha,
              TO_CHAR(NOW() AT TIME ZONE 'America/Bogota', 'HH24:MI') AS hora;`
    )
  ).rows[0];

const comprobante = async (opciones: { valor?: string; numero?: string | null; fecha?: string; banco?: string } = {}) => {
  const { fecha, hora } = await ahoraBd();
  return [
    opciones.banco ?? 'Bancolombia',
    '¡Pago exitoso!',
    `${opciones.fecha ?? fecha} ${hora}`,
    opciones.numero === null ? '' : `Comprobante No. ${opciones.numero ?? '0000085123'}`,
    'Pagaste a CENTR GEST SURCOLOM',
    `Valor del pago $${opciones.valor ?? '5.000'},00`,
  ].join('\n');
};

const reservar = (u: UsuarioTest, menuId: string) =>
  request(app).post('/api/consumos/reservar').set(auth(u)).send({ menu_id: menuId });

const subir = (u: UsuarioTest, ventaId: string, imagen: Buffer = imagenPng()) =>
  request(app).post(`/api/consumos/${ventaId}/comprobante`).set(auth(u)).set('Content-Type', 'image/png').send(imagen);

const venta = async (id: string) =>
  (await pool.query('SELECT estado, estado_pago, metodo_pago, vence_en FROM ventas WHERE id = $1;', [id])).rows[0];

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  const ficha = await crearFicha('3312744');
  encargado = await crearUsuario('Encargada QR', '8700000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz QR', '8700000002', 'aprendiz', { fichaId: ficha });
  otraAprendiz = await crearUsuario('Otra Aprendiz QR', '8700000003', 'aprendiz', { fichaId: ficha });
  instructor = await crearUsuario('Instructor QR', '8700000004', 'instructor');
  beneficiaria = await crearUsuario('Beneficiaria QR', '8700000005', 'aprendiz', { fichaId: ficha, esBeneficiario: true });
  usarLectorDePrueba(async () => {
    if (falloOcr) throw new Error('OCR no disponible');
    return { texto: textoLeido, confianza: 93 };
  });
});

beforeEach(async () => {
  fijarHoraBogota(12);
  falloOcr = false;
  await pool.query(
    'TRUNCATE TABLE comprobantes_pago, ventas, menus_dia, deudas, movimientos_kardex, alertas, auditoria, cierres_caja RESTART IDENTITY CASCADE;'
  );
});

afterAll(() => {
  usarLectorDePrueba(null);
  restaurarReloj();
});

describe('Pago con el código QR y comprobante (ADR 027)', () => {
  it('al reservar se aparta la porción 15 minutos con pago por QR', async () => {
    const menuId = await crearMenu('Menú QR', { disponible: 10 });
    const res = await reservar(aprendiz, menuId);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.metodo_pago, 'qr');
    assert.strictEqual(res.body.estado_pago, 'pendiente');
    assert.strictEqual(res.body.minutos_para_pagar, 15);
    const faltan = (new Date(res.body.vence_en).getTime() - (await pool.query('SELECT NOW() AS n')).rows[0].n.getTime()) / 60000;
    assert.ok(faltan > 14 && faltan <= 15, `faltan ${faltan} minutos`);

    const menu = await request(app).get('/api/menus/activo').set(auth(aprendiz));
    assert.strictEqual(menu.body.mi_reserva.metodo_pago, 'qr');
    assert.strictEqual(menu.body.mi_reserva.vence_en, res.body.vence_en);
    assert.strictEqual(menu.body.mi_reserva.comprobante, null);
    assert.strictEqual(menu.body.cantidad_vendida, 1);
  });

  it('un comprobante válido deja la reserva pagada y no guarda la imagen', async () => {
    const menuId = await crearMenu('Menú QR');
    const reserva = (await reservar(aprendiz, menuId)).body;
    textoLeido = await comprobante();

    const res = await subir(aprendiz, reserva.id);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.estado, 'aceptado', res.body.motivo);
    assert.deepStrictEqual(
      { banco: res.body.lectura.banco, valor: res.body.lectura.valor, numero: res.body.lectura.numero },
      { banco: 'Bancolombia', valor: 5000, numero: '0000085123' }
    );
    assert.strictEqual(res.body.reserva.estado_pago, 'pagado');
    assert.strictEqual(res.body.reserva.vence_en, null);

    const v = await venta(reserva.id);
    assert.strictEqual(v.estado_pago, 'pagado');
    const guardado = (await pool.query('SELECT estado, imagen FROM comprobantes_pago;')).rows[0];
    assert.strictEqual(guardado.estado, 'aceptado');
    assert.strictEqual(guardado.imagen, null);

    const otra = await subir(aprendiz, reserva.id);
    assert.strictEqual(otra.status, 409);
  });

  it('el mismo comprobante no sirve dos veces, ni desde otra cuenta ni con otra captura', async () => {
    const menuId = await crearMenu('Menú QR');
    const r1 = (await reservar(aprendiz, menuId)).body;
    const r2 = (await reservar(otraAprendiz, menuId)).body;
    textoLeido = await comprobante({ numero: '0000077777' });
    const imagen = imagenPng();

    assert.strictEqual((await subir(aprendiz, r1.id, imagen)).body.estado, 'aceptado');

    // Otra cuenta, la misma imagen
    const mismaImagen = await subir(otraAprendiz, r2.id, imagen);
    assert.strictEqual(mismaImagen.body.estado, 'rechazado');
    assert.match(mismaImagen.body.motivo, /ya se usó/);

    // Otra cuenta, otra captura del mismo pago (mismo banco y número)
    const otraCaptura = await subir(otraAprendiz, r2.id);
    assert.strictEqual(otraCaptura.body.estado, 'rechazado');
    assert.match(otraCaptura.body.motivo, /ya se usó/);
    assert.strictEqual((await venta(r2.id)).estado_pago, 'pendiente');

    // Con su propio comprobante sí paga
    textoLeido = await comprobante({ numero: '0000077778' });
    assert.strictEqual((await subir(otraAprendiz, r2.id)).body.estado, 'aceptado');
  });

  it('rechaza un comprobante de otro día o por otro valor y deja subir otro', async () => {
    const menuId = await crearMenu('Menú QR');
    const reserva = (await reservar(aprendiz, menuId)).body;

    textoLeido = await comprobante({ fecha: '01/01/2025' });
    const deOtroDia = await subir(aprendiz, reserva.id);
    assert.strictEqual(deOtroDia.body.estado, 'rechazado');
    assert.match(deOtroDia.body.motivo, /1 de enero de 2025/);
    assert.ok(deOtroDia.body.reserva.vence_en, 'la porción sigue apartada');

    textoLeido = await comprobante({ valor: '4.000', numero: '0000011111' });
    const otroValor = await subir(aprendiz, reserva.id);
    assert.strictEqual(otroValor.body.estado, 'rechazado');
    assert.match(otroValor.body.motivo, /\$4\.000/);

    textoLeido = await comprobante({ numero: '0000022222' });
    assert.strictEqual((await subir(aprendiz, reserva.id)).body.estado, 'aceptado');
  });

  it('el instructor paga su propio precio con QR y no se le carga deuda', async () => {
    const menuId = await crearMenu('Menú QR');
    await pool.query('UPDATE menus_dia SET precio_instructor = 10000 WHERE id = $1;', [menuId]);
    const reserva = (await reservar(instructor, menuId)).body;
    assert.strictEqual(reserva.precio, 10000);
    assert.strictEqual(reserva.metodo_pago, 'qr');
    assert.strictEqual(Number((await pool.query('SELECT COUNT(*) FROM deudas;')).rows[0].count), 0);

    textoLeido = await comprobante({ valor: '10.000', banco: 'Nequi', numero: null }).then((t) => `${t}\nReferencia M8392017`);
    const res = await subir(instructor, reserva.id);
    assert.strictEqual(res.body.estado, 'aceptado', res.body.motivo);
    assert.strictEqual(res.body.lectura.banco, 'Nequi');
    assert.strictEqual(res.body.lectura.numero, 'M8392017');
  });

  it('lo que no se puede confirmar queda en revisión y el encargado lo aprueba', async () => {
    const menuId = await crearMenu('Menú QR');
    const reserva = (await reservar(aprendiz, menuId)).body;
    textoLeido = await comprobante({ numero: null });

    const res = await subir(aprendiz, reserva.id);
    assert.strictEqual(res.body.estado, 'en_revision');
    assert.match(res.body.motivo, /número del comprobante/);
    assert.strictEqual(res.body.reserva.vence_en, null, 'en revisión la porción no vence');

    const menu = await request(app).get('/api/menus/activo').set(auth(aprendiz));
    assert.strictEqual(menu.body.mi_reserva.comprobante.estado, 'en_revision');
    assert.strictEqual((await request(app).post(`/api/consumos/${reserva.id}/cancelar`).set(auth(aprendiz))).status, 409);

    const pendientes = await request(app).get('/api/comprobantes?estado=en_revision').set(auth(encargado));
    assert.strictEqual(pendientes.status, 200);
    assert.strictEqual(pendientes.body.length, 1);
    const c = pendientes.body[0];
    assert.strictEqual(c.persona.nombre, 'Aprendiz QR');
    assert.strictEqual(c.persona.ficha, '3312744');
    assert.strictEqual(c.tiene_imagen, true);

    const img = await request(app).get(`/api/comprobantes/${c.id}/imagen`).set(auth(encargado));
    assert.strictEqual(img.status, 200);
    assert.strictEqual(img.headers['content-type'], 'image/png');

    const resumen = await request(app).get('/api/comprobantes/resumen').set(auth(encargado));
    assert.strictEqual(resumen.body.en_revision, 1);

    const aprobado = await request(app).post(`/api/comprobantes/${c.id}/aprobar`).set(auth(encargado));
    assert.strictEqual(aprobado.status, 200, JSON.stringify(aprobado.body));
    assert.strictEqual((await venta(reserva.id)).estado_pago, 'pagado');
    assert.strictEqual((await pool.query('SELECT imagen FROM comprobantes_pago WHERE id = $1;', [c.id])).rows[0].imagen, null);
    assert.strictEqual((await request(app).post(`/api/comprobantes/${c.id}/aprobar`).set(auth(encargado))).status, 409);

    const delDia = await request(app).get('/api/comprobantes').set(auth(encargado));
    assert.strictEqual(delDia.body[0].estado, 'aceptado');
    assert.strictEqual(delDia.body[0].revisado_por, 'Encargada QR');
  });

  it('si el encargado rechaza, la persona ve el motivo y tiene otros 15 minutos', async () => {
    const menuId = await crearMenu('Menú QR');
    const reserva = (await reservar(aprendiz, menuId)).body;
    falloOcr = true;
    const res = await subir(aprendiz, reserva.id);
    assert.strictEqual(res.body.estado, 'en_revision', 'si el OCR falla, decide el encargado');

    const [c] = (await request(app).get('/api/comprobantes?estado=en_revision').set(auth(encargado))).body;
    const sinMotivo = await request(app).post(`/api/comprobantes/${c.id}/rechazar`).set(auth(encargado)).send({});
    assert.strictEqual(sinMotivo.status, 400);
    const rechazo = await request(app)
      .post(`/api/comprobantes/${c.id}/rechazar`)
      .set(auth(encargado))
      .send({ motivo: 'La captura está cortada' });
    assert.strictEqual(rechazo.status, 200, JSON.stringify(rechazo.body));

    const menu = await request(app).get('/api/menus/activo').set(auth(aprendiz));
    assert.strictEqual(menu.body.mi_reserva.comprobante.estado, 'rechazado');
    assert.match(menu.body.mi_reserva.comprobante.motivo, /cortada/);
    assert.ok(menu.body.mi_reserva.vence_en, 'vuelve a tener plazo para subir otro');
  });

  it('sin comprobante a tiempo la reserva se anula y la porción vuelve al menú', async () => {
    const menuId = await crearMenu('Menú QR', { disponible: 1 });
    const reserva = (await reservar(aprendiz, menuId)).body;
    assert.strictEqual((await reservar(otraAprendiz, menuId)).status, 409, 'cupo agotado mientras está apartada');

    await pool.query("UPDATE ventas SET vence_en = NOW() - INTERVAL '1 minute' WHERE id = $1;", [reserva.id]);
    assert.strictEqual(await liberarReservasVencidas({ forzar: true }), 1);
    assert.strictEqual((await venta(reserva.id)).estado, 'anulada');
    const vendida = (await pool.query('SELECT cantidad_vendida FROM menus_dia WHERE id = $1;', [menuId])).rows[0];
    assert.strictEqual(vendida.cantidad_vendida, 0);

    textoLeido = await comprobante();
    const tarde = await subir(aprendiz, reserva.id);
    assert.strictEqual(tarde.status, 409);
    assert.match(tarde.body.message, /ya no está activa/);

    assert.strictEqual((await reservar(otraAprendiz, menuId)).status, 201, 'la porción liberada se puede reservar');
  });

  it('el beneficiario no paga ni sube comprobante', async () => {
    const menuId = await crearMenu('Menú QR');
    const reserva = (await reservar(beneficiaria, menuId)).body;
    assert.strictEqual(reserva.estado_pago, 'gratis');
    assert.strictEqual(reserva.vence_en, null);
    const res = await subir(beneficiaria, reserva.id);
    assert.strictEqual(res.status, 409);
  });

  it('valida el archivo y que la reserva sea propia', async () => {
    const menuId = await crearMenu('Menú QR');
    const reserva = (await reservar(aprendiz, menuId)).body;
    const pdf = await request(app)
      .post(`/api/consumos/${reserva.id}/comprobante`)
      .set(auth(aprendiz))
      .set('Content-Type', 'image/png')
      .send(Buffer.from('%PDF-1.7 no es una imagen'));
    assert.strictEqual(pdf.status, 400);
    const sinArchivo = await request(app).post(`/api/consumos/${reserva.id}/comprobante`).set(auth(aprendiz)).send({});
    assert.strictEqual(sinArchivo.status, 400);
    textoLeido = await comprobante();
    assert.strictEqual((await subir(otraAprendiz, reserva.id)).status, 404);
    assert.strictEqual((await request(app).get('/api/comprobantes').set(auth(aprendiz))).status, 403);
  });
});
