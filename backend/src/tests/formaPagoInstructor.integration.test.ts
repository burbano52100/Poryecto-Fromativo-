import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearMenu, crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';

/**
 * El instructor paga con el código QR (ADR 027) o fía a su cuenta del mes (ADR 028). La ventanilla
 * (ADR 026) ya no existe para reservas nuevas, pero las de contado que quedaron de antes se siguen
 * cobrando, cancelando y contando en la caja como siempre.
 */
const app = createApp();

let encargado: UsuarioTest;
let instructor: UsuarioTest;
let menuHoy: string;

const auth = (u: UsuarioTest) => ({ Authorization: `Bearer ${u.token}` });

const reservar = (u: UsuarioTest, body: object = {}) =>
  request(app).post('/api/consumos/reservar').set(auth(u)).send({ menu_id: menuHoy, ...body });

const deuda = async () =>
  (await pool.query("SELECT id, monto::float8 AS monto FROM deudas WHERE usuario_id = $1 AND estado != 'pagada';", [instructor.id]))
    .rows[0] as { id: string; monto: number } | undefined;

const venta = async (id: string) =>
  (await pool.query('SELECT metodo_pago, estado_pago, estado FROM ventas WHERE id = $1;', [id])).rows[0];

/** Venta de antes del QR: fiada ('credito') o de contado en la ventanilla ('efectivo'). */
const ventaAnterior = async (usuarioId: string, menuId: string, metodo: 'credito' | 'efectivo', diasAtras = 0) =>
  (
    await pool.query(
      `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago)
       VALUES ($1, $2, NOW() - make_interval(days => $4), 10000, $3, 'pendiente') RETURNING id;`,
      [usuarioId, menuId, metodo, diasAtras]
    )
  ).rows[0].id as string;

const deudaAnterior = async (monto: number) =>
  (await pool.query('INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes) VALUES ($1, $2, 1) RETURNING id;', [instructor.id, monto]))
    .rows[0].id as string;

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  encargado = await crearUsuario('Encargado Formas de Pago', '8600000001', 'encargado');
  instructor = await crearUsuario('Instructor Formas de Pago', '8600000002', 'instructor');
});

beforeEach(async () => {
  fijarHoraBogota(12);
  await pool.query(
    'TRUNCATE TABLE ventas, menus_dia, deudas, pagos_deuda, movimientos_kardex, alertas, cierres_caja RESTART IDENTITY CASCADE;'
  );
  menuHoy = await crearMenu('Menú de hoy');
  await pool.query('UPDATE menus_dia SET precio_instructor = 10000 WHERE id = $1;', [menuHoy]);
});

afterAll(() => restaurarReloj());

describe('El instructor fía o paga con QR (ADR 026 → ADR 027 → ADR 028)', () => {
  it('el instructor que fía reserva de una vez, sin QR, y el valor se suma a su deuda (ADR 028)', async () => {
    const res = await reservar(instructor, { forma_pago: 'fiado' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.metodo_pago, 'credito');
    assert.strictEqual(res.body.fiado, true);
    assert.strictEqual(res.body.vence_en, null, 'lo fiado no tiene plazo para subir comprobante');
    assert.strictEqual(res.body.precio, 10000);
    assert.match(res.body.message, /\$10\.000 a tu cuenta del mes/);
    assert.strictEqual((await deuda())?.monto, 10000);

    const historial = await request(app).get('/api/consumos').set(auth(instructor));
    assert.strictEqual(historial.body[0].fiado, true);

    // Otro día fiado se suma a la misma deuda abierta
    const otroMenu = await crearMenu('Menú de mañana');
    await pool.query("UPDATE menus_dia SET precio_instructor = 10000, fecha = fecha + 1 WHERE id = $1;", [otroMenu]);
    const segundo = await request(app).post('/api/consumos/reservar').set(auth(instructor)).send({ menu_id: otroMenu, forma_pago: 'fiado' });
    assert.strictEqual(segundo.status, 201, JSON.stringify(segundo.body));
    assert.strictEqual((await deuda())?.monto, 20000);
    assert.strictEqual(Number((await pool.query('SELECT COUNT(*) FROM deudas WHERE usuario_id = $1;', [instructor.id])).rows[0].count), 1);
  });

  it('sin forma de pago, o con "qr", reserva con QR; "contado" ya no existe y el aprendiz no puede fiar', async () => {
    const conQr = await reservar(instructor);
    assert.strictEqual(conQr.status, 201, JSON.stringify(conQr.body));
    assert.strictEqual(conQr.body.metodo_pago, 'qr');
    assert.ok(conQr.body.vence_en);
    assert.strictEqual(await deuda(), undefined);

    const contado = await reservar(instructor, { forma_pago: 'contado' });
    assert.strictEqual(contado.status, 400);
    assert.match(contado.body.message, /forma de pago/);

    const aprendiz = await crearUsuario('Aprendiz que quiere fiar', '8600000009', 'aprendiz');
    const fiaAprendiz = await reservar(aprendiz, { forma_pago: 'fiado' });
    assert.strictEqual(fiaAprendiz.status, 403);
    assert.match(fiaAprendiz.body.message, /Solo los instructores/);
  });

  it('cancelar un fiado de antes baja la deuda; cancelar una reserva con QR no la toca', async () => {
    const fiado = await ventaAnterior(instructor.id, menuHoy, 'credito');
    await pool.query('UPDATE menus_dia SET cantidad_vendida = 1 WHERE id = $1;', [menuHoy]);
    await deudaAnterior(10000);

    const cancelarFiado = await request(app).post(`/api/consumos/${fiado}/cancelar`).set(auth(instructor));
    assert.strictEqual(cancelarFiado.status, 200, JSON.stringify(cancelarFiado.body));
    assert.strictEqual(await deuda(), undefined, 'la deuda de ese almuerzo quedó saldada');

    await deudaAnterior(10000);
    const conQr = (await reservar(instructor)).body.id;
    assert.strictEqual((await request(app).post(`/api/consumos/${conQr}/cancelar`).set(auth(instructor))).status, 200);
    assert.strictEqual((await deuda())?.monto, 10000);
  });

  it('pagar la deuda en Cartera marca solo los fiados; la reserva con QR espera su comprobante', async () => {
    const menuAyer = await crearMenu('Menú de ayer', { diasAtras: 1, estado: 'completado' });
    const fiadoAyer = await ventaAnterior(instructor.id, menuAyer, 'credito', 1);
    const deudaId = await deudaAnterior(10000);
    const conQr = (await reservar(instructor)).body.id;

    const pago = await request(app).post(`/api/deudas/${deudaId}/pagar`).set(auth(encargado)).send({});
    assert.strictEqual(pago.status, 200, JSON.stringify(pago.body));
    assert.strictEqual((await venta(fiadoAyer)).estado_pago, 'pagado');
    assert.strictEqual((await venta(conQr)).estado_pago, 'pendiente');
  });

  it('el cierre de caja espera el contado, deja el fiado como crédito y el QR aparte', async () => {
    const otro = await crearUsuario('Instructora Fiado', '8600000003', 'instructor');
    const tercero = await crearUsuario('Instructor QR', '8600000004', 'instructor');
    await ventaAnterior(instructor.id, menuHoy, 'efectivo');
    await ventaAnterior(otro.id, menuHoy, 'credito');
    assert.strictEqual((await reservar(tercero)).status, 201);

    const res = await request(app).get('/api/cierres-caja/resumen').set(auth(encargado));
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.ingresos.instructores_contado, 10000);
    assert.strictEqual(res.body.ingresos.credito_instructores, 10000);
    assert.strictEqual(res.body.ingresos.qr_pendientes, 10000);
    assert.strictEqual(res.body.ingresos_esperados, 10000);
  });
});
