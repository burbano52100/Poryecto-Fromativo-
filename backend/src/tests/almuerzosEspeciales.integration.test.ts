import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { fechaRelativa } from './helpers/fechas.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';
import { fechaBogota } from '../utils/horario.js';

const app = createApp();

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;
let arroz: string;
let pollo: string;
let receta: string;

const api = (method: 'get' | 'post' | 'patch', path = '', token = encargado.token) =>
  request(app)[method](`/api/almuerzos-especiales${path}`).set('Authorization', `Bearer ${token}`);

const stock = async (id: string) =>
  Number((await pool.query('SELECT stock_actual FROM materiales WHERE id = $1;', [id])).rows[0].stock_actual);

const crearMaterial = async (nombre: string, codigo: string, stockInicial: number) =>
  (
    await pool.query(
      `INSERT INTO materiales (codigo_barras, nombre, unidad_medida, costo_unitario, stock_actual, stock_minimo)
       VALUES ($1, $2, 'kg', 1000, $3, 1) RETURNING id;`,
      [codigo, nombre, stockInicial]
    )
  ).rows[0].id as string;

const pedido = (cambios: Record<string, unknown> = {}) => ({
  solicitante: 'Bienestar al Aprendiz',
  responsable: 'Coordinadora de Bienestar',
  numero_contrato: 'CT-2026-118',
  fecha: fechaBogota(),
  cantidad_personas: 8,
  menu_descripcion: 'Lomo en salsa de champiñones, arroz, ensalada y postre',
  receta_id: receta,
  precio_unitario: 18000,
  ...cambios,
});

const crearPedido = async (cambios: Record<string, unknown> = {}) => {
  const res = await api('post').send(pedido(cambios));
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  return res.body as { id: string };
};

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  encargado = await crearUsuario('Encargado Especiales', '8400000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz Especiales', '8400000002', 'aprendiz');
  arroz = await crearMaterial('Arroz', 'ARZ-E', 10);
  pollo = await crearMaterial('Pollo', 'POL-E', 5);
  receta = (await pool.query("INSERT INTO recetas (codigo, nombre, precio_venta) VALUES ('REC-E', 'Plato ejecutivo', 18000) RETURNING id;"))
    .rows[0].id;
  await pool.query(
    `INSERT INTO receta_ingredientes (receta_id, material_id, cantidad, unidad, costo)
     VALUES ($1, $2, 0.125, 'kg', 125), ($1, $3, 0.2, 'kg', 200);`,
    [receta, arroz, pollo]
  );
});

beforeEach(async () => {
  fijarHoraBogota(12);
  await pool.query('TRUNCATE TABLE almuerzos_especiales, movimientos_kardex, alertas RESTART IDENTITY CASCADE;');
  await pool.query('UPDATE materiales SET stock_actual = 10 WHERE id = $1;', [arroz]);
  await pool.query('UPDATE materiales SET stock_actual = 5 WHERE id = $1;', [pollo]);
});

afterAll(() => restaurarReloj());

describe('Almuerzos especiales: registro', () => {
  it('solo el encargado los gestiona', async () => {
    assert.strictEqual((await api('get', '', aprendiz.token)).status, 403);
    assert.strictEqual((await api('post', '', aprendiz.token).send(pedido())).status, 403);
  });

  it('registra un pedido programado, sin pagar, con el total de personas por precio', async () => {
    const res = await api('post').send(pedido({ solicitante: '  Dirección General  ', numero_contrato: '   ' }));
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.solicitante, 'Dirección General');
    assert.strictEqual(res.body.numero_contrato, null);
    assert.strictEqual(res.body.estado, 'programado');
    assert.strictEqual(res.body.pagado, false);
    assert.strictEqual(res.body.total, 8 * 18000);
    assert.strictEqual(res.body.receta_nombre, 'Plato ejecutivo');
    assert.strictEqual(res.body.fecha, fechaBogota());
  });

  it('valida los datos: precio, personas, textos y receta', async () => {
    for (const [cambios, estado] of [
      [{ precio_unitario: undefined }, 400],
      [{ precio_unitario: 0 }, 400],
      [{ cantidad_personas: 0 }, 400],
      [{ cantidad_personas: 501 }, 400],
      [{ solicitante: '   ' }, 400],
      [{ menu_descripcion: '' }, 400],
      [{ fecha: '2026-02-30' }, 400],
      [{ receta_id: '00000000-0000-4000-8000-000000000000' }, 404],
    ] as const) {
      const res = await api('post').send(pedido(cambios));
      assert.strictEqual(res.status, estado, `${JSON.stringify(cambios)} → ${res.status} ${JSON.stringify(res.body)}`);
    }
    assert.strictEqual((await api('get')).body.length, 0);
  });
});

describe('Almuerzos especiales: entrega, pago y cancelación', () => {
  it('al entregarlo descuenta los ingredientes de su receta por cada persona', async () => {
    const { id } = await crearPedido();
    const res = await api('patch', `/${id}/entregado`);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.estado, 'entregado');
    assert.deepStrictEqual(res.body.avisos_inventario, []);
    assert.strictEqual(await stock(arroz), 9); // 10 - 0,125 × 8
    assert.strictEqual(await stock(pollo), 3.4); // 5 - 0,2 × 8

    const kardex = await pool.query("SELECT COUNT(*)::int AS n FROM movimientos_kardex WHERE referencia_tipo = 'almuerzo_especial' AND referencia_id = $1;", [id]);
    assert.strictEqual(kardex.rows[0].n, 2);

    assert.strictEqual((await api('patch', `/${id}/entregado`)).status, 409);
    assert.strictEqual(await stock(arroz), 9, 'entregarlo dos veces no descuenta dos veces');
  });

  it('sin receta se entrega sin tocar la bodega y lo avisa', async () => {
    const { id } = await crearPedido({ receta_id: null });
    const res = await api('patch', `/${id}/entregado`);
    assert.strictEqual(res.status, 200);
    assert.match(res.body.avisos_inventario[0], /no tiene receta/);
    assert.strictEqual(await stock(arroz), 10);
  });

  it('no se entrega antes del día del pedido', async () => {
    const { id } = await crearPedido({ fecha: fechaRelativa(3) });
    const res = await api('patch', `/${id}/entregado`);
    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /el día del pedido o después/);
  });

  it('el pago se registra solo después de la entrega y una sola vez', async () => {
    const { id } = await crearPedido();
    assert.strictEqual((await api('patch', `/${id}/pagado`)).status, 409);
    await api('patch', `/${id}/entregado`);
    const res = await api('patch', `/${id}/pagado`);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.pagado, true);
    assert.ok(res.body.fecha_hora_pago);
    assert.strictEqual((await api('patch', `/${id}/pagado`)).status, 409);
  });

  it('solo se cancela un pedido programado, y uno cancelado no se entrega', async () => {
    const programado = await crearPedido();
    const res = await api('patch', `/${programado.id}/cancelado`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.estado, 'cancelado');
    assert.strictEqual((await api('patch', `/${programado.id}/entregado`)).status, 409);

    const entregado = await crearPedido();
    await api('patch', `/${entregado.id}/entregado`);
    assert.strictEqual((await api('patch', `/${entregado.id}/cancelado`)).status, 409);
  });

  it('un identificador inválido responde 400 y uno inexistente 404', async () => {
    assert.strictEqual((await api('patch', '/no-es-uuid/entregado')).status, 400);
    assert.strictEqual((await api('patch', '/00000000-0000-4000-8000-000000000000/entregado')).status, 404);
  });
});

describe('Almuerzos especiales: resumen y ventas', () => {
  it('el resumen separa lo programado, lo que falta cobrar al contrato y lo cobrado en el mes', async () => {
    await crearPedido({ fecha: fechaRelativa(2) }); // programado
    const porCobrar = await crearPedido({ cantidad_personas: 5 });
    await api('patch', `/${porCobrar.id}/entregado`);
    const pagado = await crearPedido({ cantidad_personas: 2, receta_id: null });
    await api('patch', `/${pagado.id}/entregado`);
    await api('patch', `/${pagado.id}/pagado`);

    const res = await api('get', '/resumen');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      porCobrar: { cantidad: 1, monto: 5 * 18000 },
      programados: 1,
      cobradoMes: 2 * 18000,
    });
  });

  it('entran a Ventas y al resumen de hoy solo cuando se pagan', async () => {
    const entregado = await crearPedido({ cantidad_personas: 3, receta_id: null });
    await api('patch', `/${entregado.id}/entregado`);

    const antes = await request(app).get('/api/ventas').query({ period: 'Día' }).set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(antes.body.totales.ingresosEspeciales, 0);
    assert.ok(!antes.body.transacciones.some((t: { origen: string }) => t.origen === 'especial'));

    await api('patch', `/${entregado.id}/pagado`);

    const ventas = await request(app).get('/api/ventas').query({ period: 'Día' }).set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(ventas.status, 200);
    assert.strictEqual(ventas.body.totales.almuerzosEspeciales, 3);
    assert.strictEqual(ventas.body.totales.ingresosEspeciales, 3 * 18000);
    assert.strictEqual(ventas.body.totales.ingresosCobrados, 3 * 18000);
    const fila = ventas.body.transacciones.find((t: { origen: string }) => t.origen === 'especial');
    assert.strictEqual(fila.cliente, 'Bienestar al Aprendiz');
    assert.strictEqual(fila.ficha, 'CT-2026-118');
    assert.strictEqual(fila.personas, 3);
    assert.strictEqual(ventas.body.breakdown.at(-1).especiales, 3);

    const hoy = await request(app).get('/api/dashboard/encargado').set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(hoy.body.especialesHoy, 3);
    assert.strictEqual(hoy.body.ingresosEspecialesHoy, 3 * 18000);
    assert.strictEqual(hoy.body.ingresosHoy, 3 * 18000);
  });
});
