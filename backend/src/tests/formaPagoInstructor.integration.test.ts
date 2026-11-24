import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearMenu, crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';

const app = createApp();

let encargado: UsuarioTest;
let instructor: UsuarioTest;
let menuHoy: string;

const auth = (u: UsuarioTest) => ({ Authorization: `Bearer ${u.token}` });

const reservar = (formaPago?: 'fiado' | 'contado') =>
  request(app)
    .post('/api/consumos/reservar')
    .set(auth(instructor))
    .send(formaPago ? { menu_id: menuHoy, forma_pago: formaPago } : { menu_id: menuHoy });

const deuda = async () =>
  (await pool.query("SELECT id, monto::float8 AS monto FROM deudas WHERE usuario_id = $1 AND estado != 'pagada';", [instructor.id]))
    .rows[0] as { id: string; monto: number } | undefined;

const venta = async (id: string) =>
  (await pool.query('SELECT metodo_pago, estado_pago, estado FROM ventas WHERE id = $1;', [id])).rows[0];

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  encargado = await crearUsuario('Encargado Formas de Pago', '8600000001', 'encargado');
  instructor = await crearUsuario('Instructor Formas de Pago', '8600000002', 'instructor');
});

beforeEach(async () => {
  fijarHoraBogota(12);
  await pool.query('TRUNCATE TABLE ventas, menus_dia, deudas, pagos_deuda, movimientos_kardex, alertas, cierres_caja RESTART IDENTITY CASCADE;');
  menuHoy = await crearMenu('Menú de hoy');
  await pool.query('UPDATE menus_dia SET precio_instructor = 10000 WHERE id = $1;', [menuHoy]);
});

afterAll(() => restaurarReloj());

describe('El instructor elige fiado o de contado al reservar (ADR 026)', () => {
  it('sin elegir queda fiado, como antes: se suma a su deuda del mes', async () => {
    const res = await reservar();
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.fiado, true);
    assert.strictEqual((await venta(res.body.id)).metodo_pago, 'credito');
    assert.strictEqual((await deuda())?.monto, 10000);
  });

  it('de contado no toca la deuda: queda pendiente para pagar en la ventanilla', async () => {
    const res = await reservar('contado');
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.fiado, false);
    assert.strictEqual(res.body.precio, 10000);
    const v = await venta(res.body.id);
    assert.strictEqual(v.metodo_pago, 'efectivo');
    assert.strictEqual(v.estado_pago, 'pendiente');
    assert.strictEqual(await deuda(), undefined);

    const historial = await request(app).get('/api/consumos').set(auth(instructor));
    assert.strictEqual(historial.body[0].fiado, false);
  });

  it('rechaza una forma de pago desconocida', async () => {
    const res = await request(app).post('/api/consumos/reservar').set(auth(instructor)).send({ menu_id: menuHoy, forma_pago: 'tarjeta' });
    assert.strictEqual(res.status, 400);
  });

  it('cancelar un almuerzo de contado no cambia la deuda; cancelar uno fiado sí la baja', async () => {
    // Un fiado anterior deja una deuda de 10.000
    const menuAyer = await crearMenu('Menú de ayer', { diasAtras: 1, estado: 'completado' });
    await pool.query(
      `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago)
       VALUES ($1, $2, NOW() - interval '1 day', 10000, 'credito', 'pendiente');`,
      [instructor.id, menuAyer]
    );
    await pool.query("INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes) VALUES ($1, 10000, 1);", [instructor.id]);

    const contado = await reservar('contado');
    const cancelar = await request(app).post(`/api/consumos/${contado.body.id}/cancelar`).set(auth(instructor));
    assert.strictEqual(cancelar.status, 200, JSON.stringify(cancelar.body));
    assert.strictEqual((await deuda())?.monto, 10000);

    const fiado = await reservar('fiado');
    assert.strictEqual((await deuda())?.monto, 20000);
    await request(app).post(`/api/consumos/${fiado.body.id}/cancelar`).set(auth(instructor));
    assert.strictEqual((await deuda())?.monto, 10000);
  });

  it('pagar la deuda en Cartera marca solo los fiados; el de contado sigue esperando la ventanilla', async () => {
    const menuAyer = await crearMenu('Menú de ayer', { diasAtras: 1, estado: 'completado' });
    const fiadoAyer = (
      await pool.query(
        `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago)
         VALUES ($1, $2, NOW() - interval '1 day', 10000, 'credito', 'pendiente') RETURNING id;`,
        [instructor.id, menuAyer]
      )
    ).rows[0].id;
    const deudaId = (
      await pool.query('INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes) VALUES ($1, 10000, 1) RETURNING id;', [instructor.id])
    ).rows[0].id;
    const contado = (await reservar('contado')).body.id;

    const pago = await request(app).post(`/api/deudas/${deudaId}/pagar`).set(auth(encargado)).send({});
    assert.strictEqual(pago.status, 200, JSON.stringify(pago.body));
    assert.strictEqual((await venta(fiadoAyer)).estado_pago, 'pagado');
    assert.strictEqual((await venta(contado)).estado_pago, 'pendiente');
  });

  it('el cierre de caja espera el contado del instructor y deja el fiado como crédito', async () => {
    await reservar('contado');
    const otro = await crearUsuario('Instructora Fiado', '8600000003', 'instructor');
    const fiado = await request(app).post('/api/consumos/reservar').set(auth(otro)).send({ menu_id: menuHoy, forma_pago: 'fiado' });
    assert.strictEqual(fiado.status, 201);

    const res = await request(app).get('/api/cierres-caja/resumen').set(auth(encargado));
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.ingresos.instructores_contado, 10000);
    assert.strictEqual(res.body.ingresos.credito_instructores, 10000);
    assert.strictEqual(res.body.ingresos_esperados, 10000);
  });
});
