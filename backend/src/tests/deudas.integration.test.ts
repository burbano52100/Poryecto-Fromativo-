import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, crearMenu, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';

const app = createApp();

let encargado: UsuarioTest;
let instructor: UsuarioTest;

const pagar = (deudaId: string, body: object = {}, token = encargado.token) =>
  request(app).post(`/api/deudas/${deudaId}/pagar`).set('Authorization', `Bearer ${token}`).send(body);

/** El instructor reserva un almuerzo en cada menú; las ventas quedan con fechas crecientes. */
const reservarAlmuerzos = async (cantidad: number) => {
  for (let i = 1; i <= cantidad; i += 1) {
    const menuId = await crearMenu(`Menú ${i}`);
    const res = await request(app)
      .post('/api/consumos/reservar')
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({ menu_id: menuId });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    await pool.query("UPDATE ventas SET fecha_hora = NOW() - ($1 || ' minutes')::interval WHERE id = $2;", [
      String(cantidad - i),
      res.body.id,
    ]);
  }
  const deuda = await pool.query('SELECT id FROM deudas WHERE usuario_id = $1;', [instructor.id]);
  return deuda.rows[0].id as string;
};

const estadosVentas = async () => {
  const res = await pool.query(
    `SELECT m.nombre, v.estado_pago FROM ventas v JOIN menus_dia m ON m.id = v.menu_id
     WHERE v.usuario_id = $1 ORDER BY v.fecha_hora ASC;`,
    [instructor.id]
  );
  return res.rows.map((r) => `${r.nombre}:${r.estado_pago}`);
};

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  encargado = await crearUsuario('Encargado', '8300000001', 'encargado');
  instructor = await crearUsuario('Instructor Deudor', '8300000002', 'instructor');
});

beforeEach(async () => {
  fijarHoraBogota(12);
  await pool.query('TRUNCATE TABLE pagos_deuda, ventas, deudas, menus_dia RESTART IDENTITY CASCADE;');
});

afterAll(() => {
  restaurarReloj();
});

describe('Cartera de deudas', () => {
  it('acumula la deuda del instructor y la lista en la cartera', async () => {
    await reservarAlmuerzos(3);
    const res = await request(app).get('/api/deudas').set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].debt, 15000);
    assert.strictEqual(res.body[0].lunchesCount, 3);
    assert.strictEqual(res.body[0].status, 'ACTIVA');
  });

  it('los abonos marcan como pagadas las ventas más antiguas que alcanzan a cubrir', async () => {
    const deudaId = await reservarAlmuerzos(3);

    const primero = await pagar(deudaId, { monto: 5000 });
    assert.strictEqual(primero.status, 200);
    assert.strictEqual(primero.body.saldoRestante, 10000);
    assert.deepStrictEqual(await estadosVentas(), ['Menú 1:pagado', 'Menú 2:pendiente', 'Menú 3:pendiente']);

    // Un abono que no cubre un almuerzo completo deja pendiente el que falta por cubrir
    const segundo = await pagar(deudaId, { monto: 7000 });
    assert.strictEqual(segundo.body.saldoRestante, 3000);
    assert.deepStrictEqual(await estadosVentas(), ['Menú 1:pagado', 'Menú 2:pagado', 'Menú 3:pendiente']);

    const deuda = await pool.query('SELECT almuerzos_pendientes, estado FROM deudas WHERE id = $1;', [deudaId]);
    assert.strictEqual(deuda.rows[0].almuerzos_pendientes, 1);
    assert.strictEqual(deuda.rows[0].estado, 'pendiente');

    const final = await pagar(deudaId);
    assert.strictEqual(final.body.saldoRestante, 0);
    assert.strictEqual(final.body.estado, 'pagada');
    assert.deepStrictEqual(await estadosVentas(), ['Menú 1:pagado', 'Menú 2:pagado', 'Menú 3:pagado']);

    const pagos = await pool.query('SELECT monto_pagado::float8 AS monto FROM pagos_deuda ORDER BY fecha_pago;');
    assert.deepStrictEqual(pagos.rows.map((p) => p.monto), [5000, 7000, 3000]);
  });

  it('no cobra más que el saldo de la deuda', async () => {
    const deudaId = await reservarAlmuerzos(1);
    const res = await pagar(deudaId, { monto: 999999 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.saldoRestante, 0);
    const pagos = await pool.query('SELECT monto_pagado::float8 AS monto FROM pagos_deuda;');
    assert.strictEqual(pagos.rows[0].monto, 5000);
  });

  it('rechaza pagar una deuda ya saldada', async () => {
    const deudaId = await reservarAlmuerzos(1);
    assert.strictEqual((await pagar(deudaId)).status, 200);
    assert.strictEqual((await pagar(deudaId)).status, 400);
  });

  it('valida el monto y el identificador', async () => {
    const deudaId = await reservarAlmuerzos(1);
    assert.strictEqual((await pagar(deudaId, { monto: -100 })).status, 400);
    assert.strictEqual((await pagar('no-es-uuid')).status, 400);
    assert.strictEqual((await pagar('00000000-0000-0000-0000-000000000000')).status, 404);
  });

  it('solo el encargado puede registrar pagos', async () => {
    const deudaId = await reservarAlmuerzos(1);
    assert.strictEqual((await pagar(deudaId, {}, instructor.token)).status, 403);
  });

  it('muestra al instructor su saldo pendiente en Mi Cuenta', async () => {
    await reservarAlmuerzos(2);
    const res = await request(app).get('/api/deudas/mi-cuenta').set('Authorization', `Bearer ${instructor.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.pendingBalance, 10000);
    assert.strictEqual(res.body.monthlyLunches, 2);
    assert.strictEqual(res.body.totalConsumed, 10000);
  });
});
