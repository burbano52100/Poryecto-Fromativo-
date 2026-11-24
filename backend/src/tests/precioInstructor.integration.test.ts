import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearFicha, crearMenu, crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';
import { fechaBogota } from '../utils/horario.js';

const app = createApp();

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;
let instructor: UsuarioTest;

const auth = (u: UsuarioTest) => ({ Authorization: `Bearer ${u.token}` });

const reservar = (u: UsuarioTest, menuId: string) =>
  request(app).post('/api/consumos/reservar').set(auth(u)).send({ menu_id: menuId });

const deudaDe = async (usuarioId: string) =>
  Number(
    (await pool.query("SELECT COALESCE(SUM(monto), 0) AS monto FROM deudas WHERE usuario_id = $1 AND estado != 'pagada';", [usuarioId]))
      .rows[0].monto
  );

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  encargado = await crearUsuario('Encargado Precios', '8500000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz Precios', '8500000002', 'aprendiz', { fichaId: await crearFicha('2950001') });
  instructor = await crearUsuario('Instructor Precios', '8500000003', 'instructor');
});

beforeEach(async () => {
  fijarHoraBogota(12);
  await pool.query('TRUNCATE TABLE ventas, menus_dia, deudas, movimientos_kardex, alertas RESTART IDENTITY CASCADE;');
});

afterAll(() => restaurarReloj());

describe('Precio del almuerzo para instructores (ADR 025)', () => {
  it('el encargado publica el menú con un precio para aprendices y otro para instructores', async () => {
    const res = await request(app)
      .post('/api/menus')
      .set(auth(encargado))
      .send({ nombre: 'Menú con dos precios', fecha: fechaBogota(), precio_aprendiz: 5000, precio_instructor: 10000, cantidad_disponible: 20 });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));

    const menus = await request(app).get('/api/menus').set(auth(encargado));
    assert.strictEqual(menus.body[0].precio_aprendiz, 5000);
    assert.strictEqual(menus.body[0].precio_instructor, 10000);
  });

  it('cada rol ve y paga su precio; la deuda del instructor suma el suyo', async () => {
    const menuId = await crearMenu('Menú de hoy');
    await pool.query('UPDATE menus_dia SET precio_instructor = 10000 WHERE id = $1;', [menuId]);

    const vistaInstructor = await request(app).get('/api/menus/activo').set(auth(instructor));
    assert.strictEqual(vistaInstructor.body.precio_aplicable, 10000);
    const vistaAprendiz = await request(app).get('/api/menus/activo').set(auth(aprendiz));
    assert.strictEqual(vistaAprendiz.body.precio_aplicable, 5000);

    const resInstructor = await reservar(instructor, menuId);
    assert.strictEqual(resInstructor.status, 201, JSON.stringify(resInstructor.body));
    assert.strictEqual(resInstructor.body.precio, 10000);
    assert.strictEqual(await deudaDe(instructor.id), 10000);

    const resAprendiz = await reservar(aprendiz, menuId);
    assert.strictEqual(resAprendiz.status, 201);
    assert.strictEqual(resAprendiz.body.precio, 5000);
  });

  it('un menú sin precio de instructor le cobra el del aprendiz, como antes', async () => {
    const menuId = await crearMenu('Menú anterior');
    const vista = await request(app).get('/api/menus/activo').set(auth(instructor));
    assert.strictEqual(vista.body.precio_instructor, 5000);
    const res = await reservar(instructor, menuId);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.precio, 5000);
  });

  it('rechaza un precio de instructor negativo', async () => {
    const res = await request(app)
      .post('/api/menus')
      .set(auth(encargado))
      .send({ nombre: 'Precio malo', fecha: fechaBogota(), precio_aprendiz: 5000, precio_instructor: -1, cantidad_disponible: 20 });
    assert.strictEqual(res.status, 400);
  });
});
