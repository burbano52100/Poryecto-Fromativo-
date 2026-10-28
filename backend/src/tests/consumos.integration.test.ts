import { describe, it, beforeAll, beforeEach } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';

const app = createApp();

let aprendizToken: string;
let beneficiarioToken: string;
let aprendizId: string;

const signToken = (user: { id: string; cedula: string; nombre: string }) =>
  jwt.sign(
    { id: user.id, document: user.cedula, name: user.nombre, role: 'aprendiz' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );

const crearMenu = async (nombre: string, estado: string, disponible = 10, vendida = 0): Promise<string> => {
  const res = await pool.query(
    `INSERT INTO menus_dia (fecha, nombre, precio_aprendiz, precio_invitado, cantidad_disponible, cantidad_vendida, estado)
     VALUES (CURRENT_DATE, $1, 5000, 8000, $2, $3, $4) RETURNING id;`,
    [nombre, disponible, vendida, estado]
  );
  return res.rows[0].id;
};

const reservar = (token: string, menuId?: unknown) =>
  request(app)
    .post('/api/consumos/reservar')
    .set('Authorization', `Bearer ${token}`)
    .send(menuId === undefined ? {} : { menu_id: menuId });

const contarVentas = async (): Promise<number> => {
  const res = await pool.query('SELECT COUNT(*)::int AS n FROM ventas;');
  return res.rows[0].n;
};

beforeAll(async () => {
  await cleanDatabase();

  const users = await pool.query(
    `INSERT INTO usuarios (nombre, cedula, rol, es_beneficiario)
     VALUES ('Aprendiz Normal', '9000000001', 'aprendiz', false),
            ('Aprendiz Beneficiario', '9000000002', 'aprendiz', true)
     RETURNING id, cedula, nombre;`
  );
  aprendizId = users.rows[0].id;
  aprendizToken = signToken(users.rows[0]);
  beneficiarioToken = signToken(users.rows[1]);
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE ventas, deudas, menus_dia RESTART IDENTITY CASCADE;');
});

describe('POST /api/consumos/reservar con menu_id', () => {
  it('rechaza con 400 un menú en borrador', async () => {
    const menuId = await crearMenu('Borrador', 'borrador');
    const res = await reservar(aprendizToken, menuId);
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /no está disponible para reservas \(estado: borrador\)/);
    assert.strictEqual(await contarVentas(), 0);
  });

  it('rechaza con 400 un menú completado', async () => {
    const menuId = await crearMenu('Completado', 'completado');
    const res = await reservar(aprendizToken, menuId);
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /estado: completado/);
    assert.strictEqual(await contarVentas(), 0);
  });

  it('rechaza con 409 un menú en estado agotado', async () => {
    const menuId = await crearMenu('Agotado', 'agotado');
    const res = await reservar(aprendizToken, menuId);
    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /agotado/);
    assert.strictEqual(await contarVentas(), 0);
  });

  it('rechaza con 409 un menú activo sin cupo', async () => {
    const menuId = await crearMenu('Activo lleno', 'activo', 5, 5);
    const res = await reservar(aprendizToken, menuId);
    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /agotado/);
    assert.strictEqual(await contarVentas(), 0);
  });

  it('responde 404 si el menú no existe', async () => {
    const res = await reservar(aprendizToken, '00000000-0000-0000-0000-000000000000');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.message, 'El menú indicado no existe.');
  });

  it('responde 400 si menu_id no es un UUID válido', async () => {
    const res = await reservar(aprendizToken, 'no-es-un-uuid');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message, 'El identificador del menú no es válido.');
  });

  it('reserva un menú activo con cupo a $5.000 y descuenta el cupo', async () => {
    const menuId = await crearMenu('Activo', 'activo', 10, 0);
    const res = await reservar(aprendizToken, menuId);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.estado_pago, 'pendiente');

    const venta = await pool.query(
      'SELECT precio_cobrado::float8 AS precio, estado_pago FROM ventas WHERE usuario_id = $1;',
      [aprendizId]
    );
    assert.strictEqual(venta.rows[0].precio, 5000);

    const menu = await pool.query('SELECT cantidad_vendida FROM menus_dia WHERE id = $1;', [menuId]);
    assert.strictEqual(menu.rows[0].cantidad_vendida, 1);
  });

  it('cobra $0 a un beneficiario aunque el cliente envíe otro precio', async () => {
    const menuId = await crearMenu('Activo', 'activo', 10, 0);
    const res = await request(app)
      .post('/api/consumos/reservar')
      .set('Authorization', `Bearer ${beneficiarioToken}`)
      .send({ menu_id: menuId, precio: 5000, precio_cobrado: 5000 });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.estado_pago, 'gratis');

    const venta = await pool.query(
      "SELECT precio_cobrado::float8 AS precio FROM ventas v JOIN usuarios u ON u.id = v.usuario_id WHERE u.cedula = '9000000002';"
    );
    assert.strictEqual(venta.rows[0].precio, 0);
  });
});
