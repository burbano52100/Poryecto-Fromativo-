import { describe, it, beforeAll, beforeEach } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, crearFicha, crearMenu, type UsuarioTest } from './helpers/auth.js';

const app = createApp();

let encargado: UsuarioTest;
let normal: UsuarioTest;
let beneficiario: UsuarioTest;
let sinReserva: UsuarioTest;
let instructor: UsuarioTest;
let fichaId: string;

const insertarVenta = async (
  usuario: UsuarioTest,
  menuId: string,
  precio: number,
  estadoPago: string,
  diasAtras = 0,
  metodoPago: 'efectivo' | 'credito' = 'efectivo'
) => {
  const res = await pool.query(
    `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago)
     VALUES ($1, $2, NOW() - ($5 || ' days')::interval, $3, $6, $4) RETURNING id;`,
    [usuario.id, menuId, precio, estadoPago, String(diasAtras), metodoPago]
  );
  return res.rows[0].id as string;
};

const marcarPago = (ventaId: string, pagado: unknown, token = encargado.token) =>
  request(app)
    .patch(`/api/grupos/ventas/${ventaId}/pago`)
    .set('Authorization', `Bearer ${token}`)
    .send({ pagado });

beforeAll(async () => {
  await cleanDatabase();
  fichaId = await crearFicha('2847251', 'Análisis y Desarrollo de Software');
  await crearFicha('2847252', 'Gestión Logística');
  encargado = await crearUsuario('Encargado', '8400000001', 'encargado');
  normal = await crearUsuario('Carlos Normal', '8400000002', 'aprendiz', { fichaId });
  beneficiario = await crearUsuario('Ana Beneficiaria', '8400000003', 'aprendiz', { fichaId, esBeneficiario: true });
  sinReserva = await crearUsuario('Pedro Sin Reserva', '8400000004', 'aprendiz', { fichaId });
  instructor = await crearUsuario('Instructor', '8400000005', 'instructor', { fichaId });
});

let ventaNormal: string;
let ventaGratis: string;
let ventaInstructor: string;
let menuDeHoy: string;

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE ventas, menus_dia RESTART IDENTITY CASCADE;');
  const menuHoy = await crearMenu('Menú de hoy');
  menuDeHoy = menuHoy;
  const menuAyer = await crearMenu('Menú de ayer', { diasAtras: 1, estado: 'completado' });
  ventaNormal = await insertarVenta(normal, menuHoy, 5000, 'pendiente');
  ventaGratis = await insertarVenta(beneficiario, menuHoy, 0, 'gratis');
  // Almuerzo fiado del instructor: se cobra en Cartera de Deudas (ADR 026)
  ventaInstructor = await insertarVenta(instructor, menuHoy, 5000, 'pendiente', 0, 'credito');
  await insertarVenta(sinReserva, menuAyer, 5000, 'pagado', 1);
});

describe('GET /api/grupos', () => {
  it('lista las fichas con aprendices registrados y reservas de hoy', async () => {
    const res = await request(app).get('/api/grupos').set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 2);
    const adso = res.body.find((g: any) => g.ficha === '2847251');
    assert.strictEqual(adso.studentsCount, 3);
    assert.strictEqual(adso.reservasHoy, 2);
    assert.strictEqual(adso.pendientesHoy, 1);
    assert.strictEqual(adso.gratisHoy, 1);
    assert.strictEqual(adso.vocero, undefined);
    const logistica = res.body.find((g: any) => g.ficha === '2847252');
    assert.strictEqual(logistica.reservasHoy, 0);
  });
});

describe('GET /api/grupos/:id/aprendices', () => {
  it('devuelve solo los aprendices que reservaron hoy, sin instructores', async () => {
    const res = await request(app)
      .get(`/api/grupos/${fichaId}/aprendices`)
      .set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(
      res.body.aprendices.map((a: any) => `${a.name}:${a.estado_pago}`),
      ['Ana Beneficiaria:gratis', 'Carlos Normal:pendiente']
    );
  });

  it('responde 400 con un id inválido y 404 si la ficha no existe', async () => {
    const invalido = await request(app).get('/api/grupos/abc/aprendices').set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(invalido.status, 400);
    const inexistente = await request(app)
      .get('/api/grupos/00000000-0000-0000-0000-000000000000/aprendices')
      .set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(inexistente.status, 404);
  });
});

describe('PATCH /api/grupos/ventas/:ventaId/pago', () => {
  it('marca pagado y vuelve a pendiente, y el aprendiz lo ve en sus consumos', async () => {
    const pagado = await marcarPago(ventaNormal, true);
    assert.strictEqual(pagado.status, 200);
    assert.strictEqual(pagado.body.estado_pago, 'pagado');

    const consumos = await request(app).get('/api/consumos').set('Authorization', `Bearer ${normal.token}`);
    assert.strictEqual(consumos.body[0].paymentStatus, 'PAGADO');
    assert.strictEqual(consumos.body[0].status, 'RESERVED');

    const pendiente = await marcarPago(ventaNormal, false);
    assert.strictEqual(pendiente.body.estado_pago, 'pendiente');
  });

  it('bloquea las reservas gratis de beneficiarios', async () => {
    const res = await marcarPago(ventaGratis, true);
    assert.strictEqual(res.status, 400);
    const venta = await pool.query('SELECT estado_pago FROM ventas WHERE id = $1;', [ventaGratis]);
    assert.strictEqual(venta.rows[0].estado_pago, 'gratis');
  });

  it('no permite marcar almuerzos fiados de instructores (van en Cartera de Deudas)', async () => {
    const res = await marcarPago(ventaInstructor, true);
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /Cartera de Deudas/);
  });

  it('el almuerzo de contado de un instructor sale en su lista y se marca pagado en la ventanilla', async () => {
    const otro = await crearUsuario('Instructora Contado', '8400000006', 'instructor');
    const ventaContado = await insertarVenta(otro, menuDeHoy, 10000, 'pendiente', 0, 'efectivo');

    const lista = await request(app).get('/api/grupos/instructores-contado').set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(lista.status, 200);
    assert.deepStrictEqual(
      lista.body.instructores.map((i: { venta_id: string }) => i.venta_id),
      [ventaContado],
      'solo el de contado; el fiado no sale aquí'
    );

    const res = await marcarPago(ventaContado, true);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    const venta = await pool.query('SELECT estado_pago FROM ventas WHERE id = $1;', [ventaContado]);
    assert.strictEqual(venta.rows[0].estado_pago, 'pagado');
  });

  it('valida el cuerpo, el id y el rol', async () => {
    assert.strictEqual((await marcarPago(ventaNormal, 'si')).status, 400);
    assert.strictEqual((await marcarPago('xyz', true)).status, 400);
    assert.strictEqual((await marcarPago('00000000-0000-0000-0000-000000000000', true)).status, 404);
    assert.strictEqual((await marcarPago(ventaNormal, true, normal.token)).status, 403);
  });
});
