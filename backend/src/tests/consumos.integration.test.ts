import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';
import { firmarToken, crearMenu as crearMenuDelDia } from './helpers/auth.js';

const app = createApp();

let aprendizToken: string;
let beneficiarioToken: string;
let aprendizId: string;

const signToken = (user: { id: string; cedula: string; nombre: string }) =>
  jwt.sign(
    { id: user.id, document: user.cedula, name: user.nombre, role: 'aprendiz' },
    process.env.JWT_SECRET as string,
    { expiresIn: '2d' }
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
  fijarHoraBogota(12);
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
  fijarHoraBogota(12);
  await pool.query('TRUNCATE TABLE ventas, deudas, menus_dia RESTART IDENTITY CASCADE;');
});

afterAll(() => {
  restaurarReloj();
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

describe('POST /api/consumos/reservar: horario y roles', () => {
  it('rechaza con 409 una reserva antes de las 7:00 a. m.', async () => {
    await crearMenu('Activo', 'activo');
    fijarHoraBogota(6, 59);
    const res = await reservar(aprendizToken);
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.fuera_de_horario, true);
    assert.strictEqual(await contarVentas(), 0);
  });

  it('rechaza con 409 una reserva a las 9:00 p. m. en punto', async () => {
    await crearMenu('Activo', 'activo');
    fijarHoraBogota(21, 0);
    const res = await reservar(aprendizToken);
    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /7:00 a\. m\. a 9:00 p\. m\./);
  });

  it('acepta reservas desde las 7:00 a. m. y hasta las 8:59 p. m.', async () => {
    await crearMenu('Activo', 'activo');
    fijarHoraBogota(7, 0);
    assert.strictEqual((await reservar(aprendizToken)).status, 201);
    fijarHoraBogota(20, 59);
    assert.strictEqual((await reservar(beneficiarioToken)).status, 201);
  });

  it('no permite reservar al encargado', async () => {
    await crearMenu('Activo', 'activo');
    const encargado = await pool.query(
      "INSERT INTO usuarios (nombre, cedula, rol) VALUES ('Encargado', '9000000009', 'encargado') RETURNING id, cedula, nombre;"
    );
    const res = await reservar(firmarToken(encargado.rows[0], 'encargado'));
    assert.strictEqual(res.status, 403);
    assert.strictEqual(await contarVentas(), 0);
  });

  it('guarda la reserva pendiente de un aprendiz con metodo_pago efectivo', async () => {
    await crearMenu('Activo', 'activo');
    assert.strictEqual((await reservar(aprendizToken)).status, 201);
    const venta = await pool.query('SELECT metodo_pago, estado_pago FROM ventas WHERE usuario_id = $1;', [aprendizId]);
    assert.strictEqual(venta.rows[0].metodo_pago, 'efectivo');
    assert.strictEqual(venta.rows[0].estado_pago, 'pendiente');
  });

  it('rechaza con 409 una segunda reserva del mismo menú', async () => {
    await crearMenu('Activo', 'activo');
    assert.strictEqual((await reservar(aprendizToken)).status, 201);
    const res = await reservar(aprendizToken);
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.duplicate, true);
  });
});

describe('GET /api/consumos y /api/consumos/resumen', () => {
  it('marca como RESERVED la reserva de hoy y CONSUMED la de un día anterior', async () => {
    const menuAyer = await crearMenuDelDia('Menú de ayer', { diasAtras: 1 });
    await pool.query(
      `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago)
       VALUES ($1, $2, NOW() - interval '1 day', 5000, 'efectivo', 'pagado');`,
      [aprendizId, menuAyer]
    );
    const menuHoy = await crearMenuDelDia('Menú de hoy');
    assert.strictEqual((await reservar(aprendizToken, menuHoy)).status, 201);

    const res = await request(app).get('/api/consumos').set('Authorization', `Bearer ${aprendizToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 2);
    const hoy = res.body.find((c: any) => c.title === 'Menú de hoy');
    const ayer = res.body.find((c: any) => c.title === 'Menú de ayer');
    assert.strictEqual(hoy.status, 'RESERVED');
    assert.strictEqual(hoy.paymentStatus, 'PENDIENTE');
    assert.strictEqual(ayer.status, 'CONSUMED');
    assert.strictEqual(ayer.paymentStatus, 'PAGADO');
    assert.ok(!Number.isNaN(Date.parse(hoy.fecha)));
  });

  it('resume los consumos del usuario y lo pendiente por pagar', async () => {
    const menuHoy = await crearMenuDelDia('Menú de hoy');
    assert.strictEqual((await reservar(aprendizToken, menuHoy)).status, 201);

    const res = await request(app).get('/api/consumos/resumen').set('Authorization', `Bearer ${aprendizToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalAlmuerzos, 1);
    assert.strictEqual(res.body.almuerzosMes, 1);
    assert.strictEqual(res.body.gastoMes, 5000);
    assert.strictEqual(res.body.pendientePago, 5000);
  });
});

describe('GET /api/menus/activo', () => {
  it('informa la reserva del usuario y deja de ser reservable', async () => {
    const menuId = await crearMenuDelDia('Menú de hoy');
    const antes = await request(app).get('/api/menus/activo').set('Authorization', `Bearer ${beneficiarioToken}`);
    assert.strictEqual(antes.body.reservable, true);
    assert.strictEqual(antes.body.precio_aplicable, 0);
    assert.strictEqual(antes.body.es_beneficiario, true);
    assert.strictEqual(antes.body.mi_reserva, null);

    assert.strictEqual((await reservar(beneficiarioToken, menuId)).status, 201);

    const despues = await request(app).get('/api/menus/activo').set('Authorization', `Bearer ${beneficiarioToken}`);
    assert.strictEqual(despues.body.reservable, false);
    assert.strictEqual(despues.body.mi_reserva.estado_pago, 'gratis');
  });

  it('no es reservable fuera de horario', async () => {
    await crearMenuDelDia('Menú de hoy');
    fijarHoraBogota(22);
    const res = await request(app).get('/api/menus/activo').set('Authorization', `Bearer ${aprendizToken}`);
    assert.strictEqual(res.body.horario.abierto, false);
    assert.strictEqual(res.body.reservable, false);
    assert.match(res.body.motivo_no_reservable, /9:00 p\. m\./);
  });
});
