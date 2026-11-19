import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, crearFicha, crearMenu, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';
import { fechaRelativa } from './helpers/fechas.js';

const app = createApp();

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;
let instructor: UsuarioTest;
let arroz: string;
let pollo: string;
let receta: string;

const auth = (u: UsuarioTest) => ({ Authorization: `Bearer ${u.token}` });

const stock = async (id: string) =>
  Number((await pool.query('SELECT stock_actual FROM materiales WHERE id = $1;', [id])).rows[0].stock_actual);

const kardexDe = async (referenciaId: string) =>
  (
    await pool.query(
      `SELECT m.nombre, k.tipo, k.referencia_tipo, k.cantidad_entrada::float8 AS entrada, k.cantidad_salida::float8 AS salida,
              k.saldo_resultante::float8 AS saldo, k.usuario_id, k.concepto
       FROM movimientos_kardex k JOIN materiales m ON m.id = k.material_id
       WHERE k.referencia_id = $1 ORDER BY m.nombre, k.fecha_hora;`,
      [referenciaId]
    )
  ).rows;

const crearMaterial = async (nombre: string, codigo: string, stockInicial: number, minimo = 1) =>
  (
    await pool.query(
      `INSERT INTO materiales (codigo_barras, nombre, unidad_medida, costo_unitario, stock_actual, stock_minimo)
       VALUES ($1, $2, 'kg', 1000, $3, $4) RETURNING id;`,
      [codigo, nombre, stockInicial, minimo]
    )
  ).rows[0].id as string;

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  encargado = await crearUsuario('Encargada Cocina', '8200000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz Receta', '8200000002', 'aprendiz', { fichaId: await crearFicha('2900001') });
  instructor = await crearUsuario('Instructor Receta', '8200000003', 'instructor');
  arroz = await crearMaterial('Arroz', 'ARZ-1', 10);
  pollo = await crearMaterial('Pollo', 'POL-1', 5);
  receta = (await pool.query("INSERT INTO recetas (codigo, nombre, precio_venta) VALUES ('REC-1', 'Arroz con pollo', 5000) RETURNING id;")).rows[0].id;
  await pool.query(
    `INSERT INTO receta_ingredientes (receta_id, material_id, cantidad, unidad, costo)
     VALUES ($1, $2, 0.125, 'kg', 125), ($1, $3, 0.2, 'kg', 200);`,
    [receta, arroz, pollo]
  );
});

beforeEach(async () => {
  fijarHoraBogota(12);
  await pool.query('TRUNCATE TABLE ventas, menus_dia, almuerzos_invitados, movimientos_kardex, alertas, deudas, cierres_caja RESTART IDENTITY CASCADE;');
  await pool.query('UPDATE materiales SET stock_actual = 10 WHERE id = $1;', [arroz]);
  await pool.query('UPDATE materiales SET stock_actual = 5 WHERE id = $1;', [pollo]);
});

afterAll(() => restaurarReloj());

const menuConReceta = async () => {
  const id = await crearMenu('Arroz con pollo');
  await pool.query('UPDATE menus_dia SET receta_id = $1 WHERE id = $2;', [receta, id]);
  return id;
};

describe('El menú del día se relaciona con una receta', () => {
  it('el encargado elige la receta al publicar el menú', async () => {
    const recetas = await request(app).get('/api/menus/recetas').set(auth(encargado));
    assert.deepStrictEqual(recetas.body.map((r: any) => r.nombre), ['Arroz con pollo']);
    const res = await request(app)
      .post('/api/menus')
      .set(auth(encargado))
      .send({ nombre: 'Con receta', fecha: '2026-12-01', precio_aprendiz: 5000, cantidad_disponible: 10, receta_id: receta });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.receta_id, receta);
  });
});

describe('Descuento por cada almuerzo vendido', () => {
  it('una reserva descuenta los ingredientes con una salida en el kardex con usuario y saldo final', async () => {
    await menuConReceta();
    const res = await request(app).post('/api/consumos/reservar').set(auth(aprendiz)).send({});
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));

    assert.strictEqual(await stock(arroz), 9.87); // 0.125 kg se descuenta como 0.13 (el stock tiene 2 decimales)
    assert.strictEqual(await stock(pollo), 4.8);
    const kardex = await kardexDe(res.body.id);
    assert.deepStrictEqual(
      kardex.map((k) => [k.nombre, k.tipo, k.referencia_tipo, k.salida, k.saldo]),
      [
        ['Arroz', 'salida', 'venta', 0.13, 9.87],
        ['Pollo', 'salida', 'venta', 0.2, 4.8],
      ]
    );
    assert.ok(kardex.every((k) => k.usuario_id === aprendiz.id && /Aprendiz Receta/.test(k.concepto)));
    const auditoria = await pool.query("SELECT 1 FROM auditoria WHERE accion = 'descontar' AND entidad_id = $1;", [res.body.id]);
    assert.strictEqual(auditoria.rowCount, 1);
  });

  it('cancelar la reserva genera el movimiento inverso y devuelve el cupo y la deuda', async () => {
    const menu = await menuConReceta();
    const reserva = await request(app).post('/api/consumos/reservar').set(auth(instructor)).send({});
    assert.strictEqual(reserva.status, 201);

    const cancelar = await request(app).post(`/api/consumos/${reserva.body.id}/cancelar`).set(auth(instructor));
    assert.strictEqual(cancelar.status, 200, JSON.stringify(cancelar.body));
    assert.strictEqual(await stock(arroz), 10);
    assert.strictEqual(await stock(pollo), 5);
    const kardex = await kardexDe(reserva.body.id);
    assert.deepStrictEqual(
      kardex.filter((k) => k.tipo === 'entrada').map((k) => [k.nombre, k.referencia_tipo, k.entrada]),
      [
        ['Arroz', 'venta_reversa', 0.13],
        ['Pollo', 'venta_reversa', 0.2],
      ]
    );
    const venta = await pool.query('SELECT estado FROM ventas WHERE id = $1;', [reserva.body.id]);
    assert.strictEqual(venta.rows[0].estado, 'anulada');
    const cupo = await pool.query('SELECT cantidad_vendida FROM menus_dia WHERE id = $1;', [menu]);
    assert.strictEqual(cupo.rows[0].cantidad_vendida, 0);
    const deuda = await pool.query('SELECT monto::float8 AS monto, estado FROM deudas WHERE usuario_id = $1;', [instructor.id]);
    assert.deepStrictEqual(deuda.rows[0], { monto: 0, estado: 'pagada' });

    // Una segunda cancelación no vuelve a sumar stock
    assert.strictEqual((await request(app).post(`/api/consumos/${reserva.body.id}/cancelar`).set(auth(instructor))).status, 409);
    assert.strictEqual(await stock(arroz), 10);
  });

  it('cada persona de un registro de invitados descuenta una porción; editar y eliminar revierten', async () => {
    await menuConReceta();
    const crear = await request(app).post('/api/almuerzos-invitados').set(auth(encargado)).send({ tipo: 'corriente', cantidad: 4 });
    assert.strictEqual(crear.status, 201, JSON.stringify(crear.body));
    assert.deepStrictEqual(crear.body.avisos_inventario, []);
    assert.strictEqual(await stock(arroz), 9.5);
    assert.strictEqual(await stock(pollo), 4.2);

    const editar = await request(app)
      .put(`/api/almuerzos-invitados/${crear.body.id}`)
      .set(auth(encargado))
      .send({ cantidad: 2, fecha_hora: `${fechaRelativa(0)}T08:00` });
    assert.strictEqual(editar.status, 200, JSON.stringify(editar.body));
    assert.strictEqual(await stock(arroz), 9.75);
    assert.strictEqual(await stock(pollo), 4.6);
    const tipos = (await kardexDe(crear.body.id)).map((k) => k.referencia_tipo);
    assert.deepStrictEqual(tipos.filter((t) => t === 'almuerzo_invitado_reversa').length, 2);

    const eliminar = await request(app).delete(`/api/almuerzos-invitados/${crear.body.id}`).set(auth(encargado));
    assert.strictEqual(eliminar.status, 200);
    assert.strictEqual(await stock(arroz), 10);
    assert.strictEqual(await stock(pollo), 5);
  });
});

describe('Stock insuficiente y menú sin receta', () => {
  it('no bloquea la venta, el saldo no queda negativo, el material queda Crítico y se alerta con el faltante', async () => {
    await menuConReceta();
    await pool.query('UPDATE materiales SET stock_actual = 0.5 WHERE id = $1;', [pollo]);
    const res = await request(app).post('/api/almuerzos-invitados').set(auth(encargado)).send({ tipo: 'aprendiz', cantidad: 5 });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(await stock(pollo), 0);
    assert.match(res.body.avisos_inventario[0], /Stock insuficiente de Pollo: faltaron 0.5 kg/);

    const material = await request(app).get('/api/inventario/materiales').set(auth(encargado));
    const estadoPollo = material.body.find((m: any) => m.name === 'Pollo' || m.nombre === 'Pollo');
    assert.ok(JSON.stringify(estadoPollo).includes('Crítico'), JSON.stringify(estadoPollo));

    const alerta = await pool.query("SELECT mensaje, datos FROM alertas WHERE tipo = 'stock_insuficiente';");
    assert.match(alerta.rows[0].mensaje, /Pollo: faltan 0.5 kg/);
    assert.strictEqual(alerta.rows[0].datos.faltantes[0].faltante, 0.5);
  });

  it('si el menú no tiene receta no descuenta y avisa una sola vez', async () => {
    await crearMenu('Sin receta');
    for (let i = 0; i < 2; i++) {
      const res = await request(app).post('/api/almuerzos-invitados').set(auth(encargado)).send({ tipo: 'corriente', cantidad: 1 });
      assert.strictEqual(res.status, 201);
      assert.match(res.body.avisos_inventario[0], /no tiene receta/);
    }
    assert.strictEqual(await stock(arroz), 10);
    const alertas = await pool.query("SELECT COUNT(*)::int AS n FROM alertas WHERE tipo = 'menu_sin_receta';");
    assert.strictEqual(alertas.rows[0].n, 1);
  });
});
