import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearMenu, crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';

/**
 * Fiado y pago en la ventanilla del instructor (ADR 026), reemplazados por el pago con QR (ADR 027).
 * Las reservas nuevas ya no se pueden fiar, pero las fiadas o de contado que quedaron de antes se
 * siguen cobrando, cancelando y contando en la caja como siempre.
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

describe('Fiado y ventanilla de antes del pago con QR (ADR 026 → ADR 027)', () => {
  it('la forma de pago que envíe el instructor se ignora: reserva con QR y sin deuda', async () => {
    for (const formaPago of ['fiado', 'contado', 'tarjeta']) {
      await pool.query('TRUNCATE TABLE ventas RESTART IDENTITY CASCADE;');
      await pool.query('UPDATE menus_dia SET cantidad_vendida = 0;');
      const res = await reservar(instructor, { forma_pago: formaPago });
      assert.strictEqual(res.status, 201, JSON.stringify(res.body));
      assert.strictEqual(res.body.metodo_pago, 'qr');
      assert.strictEqual(res.body.fiado, false);
      assert.strictEqual(res.body.precio, 10000);
    }
    assert.strictEqual(await deuda(), undefined);
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
