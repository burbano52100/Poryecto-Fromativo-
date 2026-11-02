import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, crearFicha, crearMenu, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';

const app = createApp();

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;
let instructor: UsuarioTest;

const api = (method: 'get' | 'patch', path: string, token: string, body?: object) => {
  const req = request(app)[method](`/api/beneficiarios${path}`).set('Authorization', `Bearer ${token}`);
  return body ? req.send(body) : req;
};

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  const fichaId = await crearFicha('2847251');
  encargado = await crearUsuario('Encargado', '8100000001', 'encargado');
  aprendiz = await crearUsuario('Bruno Aprendiz', '8100000002', 'aprendiz', { fichaId });
  await crearUsuario('Ana Beneficiaria', '8100000003', 'aprendiz', { fichaId, esBeneficiario: true });
  instructor = await crearUsuario('Instructor', '8100000004', 'instructor');
});

beforeEach(async () => {
  fijarHoraBogota(12);
  await pool.query("UPDATE usuarios SET es_beneficiario = (cedula = '8100000003');");
  await pool.query('TRUNCATE TABLE ventas, menus_dia RESTART IDENTITY CASCADE;');
});

afterAll(() => {
  restaurarReloj();
});

describe('Rutas de beneficiarios', () => {
  it('solo las puede usar el encargado', async () => {
    assert.strictEqual((await api('get', '/estudiantes', aprendiz.token)).status, 403);
    assert.strictEqual((await api('get', '/', instructor.token)).status, 403);
    assert.strictEqual((await api('patch', `/${aprendiz.id}`, aprendiz.token, { es_beneficiario: true })).status, 403);
    assert.strictEqual((await request(app).get('/api/beneficiarios')).status, 401);
  });

  it('lista todos los aprendices registrados, sin otros roles', async () => {
    const res = await api('get', '/estudiantes', encargado.token);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(
      res.body.map((e: any) => e.name),
      ['Ana Beneficiaria', 'Bruno Aprendiz']
    );
    assert.strictEqual(res.body[0].ficha, '2847251');
  });

  it('lista solo los beneficiarios actuales', async () => {
    const res = await api('get', '/', encargado.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].document, '8100000003');
  });

  it('asigna y quita el beneficio', async () => {
    const asignar = await api('patch', `/${aprendiz.id}`, encargado.token, { es_beneficiario: true });
    assert.strictEqual(asignar.status, 200);
    assert.strictEqual(asignar.body.aprendiz.es_beneficiario, true);
    assert.strictEqual((await api('get', '/', encargado.token)).body.length, 2);

    const quitar = await api('patch', `/${aprendiz.id}`, encargado.token, { es_beneficiario: false });
    assert.strictEqual(quitar.status, 200);
    assert.strictEqual((await api('get', '/', encargado.token)).body.length, 1);
  });

  it('valida el cuerpo y el identificador', async () => {
    assert.strictEqual((await api('patch', `/${aprendiz.id}`, encargado.token, { es_beneficiario: 'si' })).status, 400);
    assert.strictEqual((await api('patch', '/no-es-uuid', encargado.token, { es_beneficiario: true })).status, 400);
  });

  it('responde 404 si el usuario no es aprendiz', async () => {
    const res = await api('patch', `/${instructor.id}`, encargado.token, { es_beneficiario: true });
    assert.strictEqual(res.status, 404);
  });

  it('cambia el precio desde la siguiente reserva sin tocar las anteriores', async () => {
    await api('patch', `/${aprendiz.id}`, encargado.token, { es_beneficiario: true });
    const menuHoy = await crearMenu('Menú gratis');
    const reserva = await request(app)
      .post('/api/consumos/reservar')
      .set('Authorization', `Bearer ${aprendiz.token}`)
      .send({ menu_id: menuHoy });
    assert.strictEqual(reserva.status, 201);
    assert.strictEqual(reserva.body.precio, 0);

    await api('patch', `/${aprendiz.id}`, encargado.token, { es_beneficiario: false });
    const otroMenu = await crearMenu('Menú pagado');
    const segunda = await request(app)
      .post('/api/consumos/reservar')
      .set('Authorization', `Bearer ${aprendiz.token}`)
      .send({ menu_id: otroMenu });
    assert.strictEqual(segunda.status, 201);
    assert.strictEqual(segunda.body.precio, 5000);

    const ventas = await pool.query(
      `SELECT m.nombre, v.precio_cobrado::float8 AS precio, v.estado_pago
       FROM ventas v JOIN menus_dia m ON m.id = v.menu_id WHERE v.usuario_id = $1 ORDER BY m.nombre;`,
      [aprendiz.id]
    );
    assert.deepStrictEqual(ventas.rows, [
      { nombre: 'Menú gratis', precio: 0, estado_pago: 'gratis' },
      { nombre: 'Menú pagado', precio: 5000, estado_pago: 'pendiente' },
    ]);
  });
});
