import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';

const app = createApp();

let encargadoToken: string;
let aprendizToken: string;
let contadorCodigo = 0;

const signToken = (user: { id: string; cedula: string; nombre: string }, role: string) =>
  jwt.sign({ id: user.id, document: user.cedula, name: user.nombre, role }, process.env.JWT_SECRET as string, {
    expiresIn: '1h',
  });

const api = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, body?: object, token = encargadoToken) => {
  const req = request(app)[method](`/api/inventario${path}`).set('Authorization', `Bearer ${token}`);
  return body ? req.send(body) : req;
};

const crearMaterial = async (extra: Record<string, unknown> = {}) => {
  contadorCodigo += 1;
  const res = await api('post', '/materiales', {
    name: `Material ${contadorCodigo}`,
    code: `TEST-${contadorCodigo}`,
    unit: 'Kg',
    stock: 10,
    stock_minimo: 5,
    costo_unitario: 1000,
    ...extra,
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  return res.body;
};

const stockDe = async (id: string): Promise<number> => {
  const res = await pool.query('SELECT stock_actual::float8 AS stock FROM materiales WHERE id = $1;', [id]);
  return res.rows[0].stock;
};

const movimientosDe = async (id: string) => {
  const res = await pool.query(
    `SELECT tipo, cantidad_entrada::float8 AS entrada, cantidad_salida::float8 AS salida, saldo_resultante::float8 AS saldo
     FROM movimientos_kardex WHERE material_id = $1 ORDER BY fecha_hora, created_at;`,
    [id]
  );
  return res.rows;
};

beforeAll(async () => {
  await cleanDatabase();
  const users = await pool.query(
    `INSERT INTO usuarios (nombre, cedula, rol)
     VALUES ('Encargado Test', '9100000001', 'encargado'), ('Aprendiz Test', '9100000002', 'aprendiz')
     RETURNING id, cedula, nombre, rol;`
  );
  encargadoToken = signToken(users.rows[0], 'encargado');
  aprendizToken = signToken(users.rows[1], 'aprendiz');
});

describe('Inventario: permisos', () => {
  it('un aprendiz recibe 403 en todos los endpoints de inventario', async () => {
    const id = randomUUID();
    const llamadas = [
      api('get', '/materiales', undefined, aprendizToken),
      api('post', '/materiales', { name: 'X', stock: 1 }, aprendizToken),
      api('patch', `/materiales/${id}`, { name: 'Y' }, aprendizToken),
      api('delete', `/materiales/${id}`, undefined, aprendizToken),
      api('post', `/materiales/${id}/entradas`, { cantidad: 1 }, aprendizToken),
      api('post', `/materiales/${id}/salidas`, { cantidad: 1, concepto: 'abc' }, aprendizToken),
      api('get', '/recetas', undefined, aprendizToken),
      api('post', '/recetas', {}, aprendizToken),
      api('get', '/kardex', undefined, aprendizToken),
      api('post', '/mermas', {}, aprendizToken),
    ];
    for (const res of await Promise.all(llamadas)) {
      assert.strictEqual(res.status, 403);
    }
  });
});

describe('Inventario: stock y kardex', () => {
  it('crear un material registra su ingreso inicial en el kardex', async () => {
    const mat = await crearMaterial({ stock: 12.5 });
    assert.strictEqual(mat.stock, 12.5);
    assert.deepStrictEqual(await movimientosDe(mat.id), [{ tipo: 'entrada', entrada: 12.5, salida: null, saldo: 12.5 }]);
  });

  it('entradas y salidas actualizan el stock y encadenan el saldo del kardex', async () => {
    const mat = await crearMaterial({ stock: 10 });
    const entrada = await api('post', `/materiales/${mat.id}/entradas`, { cantidad: 5.25, concepto: 'Compra' });
    assert.strictEqual(entrada.status, 201);
    assert.strictEqual(entrada.body.material.stock, 15.25);

    const salida = await api('post', `/materiales/${mat.id}/salidas`, { cantidad: 3, concepto: 'Producción del día' });
    assert.strictEqual(salida.status, 201);
    assert.strictEqual(salida.body.material.stock, 12.25);

    assert.deepStrictEqual(await movimientosDe(mat.id), [
      { tipo: 'entrada', entrada: 10, salida: null, saldo: 10 },
      { tipo: 'entrada', entrada: 5.25, salida: null, saldo: 15.25 },
      { tipo: 'salida', entrada: null, salida: 3, saldo: 12.25 },
    ]);
    assert.strictEqual(await stockDe(mat.id), 12.25);
  });

  it('una salida mayor al stock responde 409 y no registra nada', async () => {
    const mat = await crearMaterial({ stock: 4 });
    const res = await api('post', `/materiales/${mat.id}/salidas`, { cantidad: 4.5, concepto: 'Producción' });
    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /^Stock insuficiente/);
    assert.strictEqual(await stockDe(mat.id), 4);
    assert.strictEqual((await movimientosDe(mat.id)).length, 1);
  });

  it('valida cantidades: positivas y con máximo de decimales', async () => {
    const mat = await crearMaterial();
    const negativa = await api('post', `/materiales/${mat.id}/entradas`, { cantidad: -1 });
    assert.strictEqual(negativa.status, 400);
    assert.match(negativa.body.message, /La cantidad debe ser mayor a 0\./);

    const cero = await api('post', `/materiales/${mat.id}/salidas`, { cantidad: 0, concepto: 'Prueba' });
    assert.strictEqual(cero.status, 400);

    const decimales = await api('post', `/materiales/${mat.id}/entradas`, { cantidad: 1.125 });
    assert.strictEqual(decimales.status, 400);
    assert.match(decimales.body.message, /máximo 2 decimales/);

    const texto = await api('post', `/materiales/${mat.id}/entradas`, { cantidad: 'mucho' });
    assert.strictEqual(texto.status, 400);

    assert.strictEqual((await movimientosDe(mat.id)).length, 1);
  });

  it('responde 404 al mover stock de un material inexistente y 400 con un id inválido', async () => {
    const inexistente = await api('post', `/materiales/${randomUUID()}/entradas`, { cantidad: 1 });
    assert.strictEqual(inexistente.status, 404);
    const invalido = await api('post', '/materiales/abc/entradas', { cantidad: 1 });
    assert.strictEqual(invalido.status, 400);
  });

  it('PATCH edita datos del material pero no permite tocar el stock', async () => {
    const mat = await crearMaterial();
    const ok = await api('patch', `/materiales/${mat.id}`, { name: 'Lenteja', stock_minimo: 2.5, expiry: '31/12/2026' });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.body.name, 'Lenteja');
    assert.strictEqual(ok.body.stock_minimo, 2.5);
    assert.strictEqual(ok.body.expiry, '31/12/2026');

    const conStock = await api('patch', `/materiales/${mat.id}`, { stock: 999 });
    assert.strictEqual(conStock.status, 400);
    assert.strictEqual(conStock.body.message, 'El stock solo se modifica con entradas, salidas o mermas.');

    const fechaMala = await api('patch', `/materiales/${mat.id}`, { expiry: '31/02/2026' });
    assert.strictEqual(fechaMala.status, 400);
  });

  it('GET /materiales devuelve decimales sin truncar', async () => {
    const mat = await crearMaterial({ stock: 7.75, stock_minimo: 1.5, costo_unitario: 1234.56 });
    const res = await api('get', '/materiales');
    const fila = res.body.find((m: { id: string }) => m.id === mat.id);
    assert.strictEqual(fila.stock, 7.75);
    assert.strictEqual(fila.stock_minimo, 1.5);
    assert.strictEqual(fila.costo, 1234.56);
  });
});

describe('Inventario: estado del material', () => {
  it('calcula Bueno, Bajo, Crítico y Venciendo', async () => {
    const hoyRes = await pool.query("SELECT ((NOW() AT TIME ZONE 'America/Bogota')::date)::text AS hoy;");
    const hoy: string = hoyRes.rows[0].hoy;
    const dias = (n: number) => {
      const d = new Date(`${hoy}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };

    const casos = [
      { stock: 11, stock_minimo: 10, expiry: dias(30), esperado: 'Bueno' },
      { stock: 10, stock_minimo: 10, expiry: dias(30), esperado: 'Bajo' },
      { stock: 8, stock_minimo: 10, expiry: dias(30), esperado: 'Bajo' },
      { stock: 5, stock_minimo: 10, expiry: dias(30), esperado: 'Crítico' },
      { stock: 50, stock_minimo: 10, expiry: dias(5), esperado: 'Venciendo' },
      { stock: 50, stock_minimo: 10, expiry: dias(6), esperado: 'Bueno' },
      { stock: 50, stock_minimo: 10, expiry: dias(-1), esperado: 'Venciendo' },
      { stock: 1, stock_minimo: 10, expiry: dias(2), esperado: 'Venciendo' },
    ];

    const res = await Promise.all(casos.map(({ esperado: _e, ...c }) => crearMaterial(c)));
    res.forEach((mat, i) => assert.strictEqual(mat.estado, casos[i].esperado, `caso ${i}: ${JSON.stringify(casos[i])}`));
  });
});

describe('Inventario: mermas', () => {
  it('una merma descuenta stock y deja su movimiento enlazado en el kardex', async () => {
    const mat = await crearMaterial({ stock: 20 });
    const res = await api('post', '/mermas', { material_id: mat.id, quantity: 2.5, reason: 'Producto dañado' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.stock_resultante, 17.5);
    assert.strictEqual(await stockDe(mat.id), 17.5);

    const merma = await pool.query(
      `SELECT mer.cantidad_perdida::float8 AS cantidad, k.tipo, k.cantidad_salida::float8 AS salida,
              k.saldo_resultante::float8 AS saldo, k.referencia_id = mer.id AS enlazada_ida
       FROM mermas mer JOIN movimientos_kardex k ON k.id = mer.movimiento_kardex_id
       WHERE mer.id = $1;`,
      [res.body.id]
    );
    assert.deepStrictEqual(merma.rows[0], { cantidad: 2.5, tipo: 'merma', salida: 2.5, saldo: 17.5, enlazada_ida: true });
  });

  it('acepta el nombre exacto del material pero no coincidencias parciales', async () => {
    const mat = await crearMaterial({ name: 'Tomate Chonto Exacto', stock: 5 });
    const exacto = await api('post', '/mermas', { material: 'Tomate Chonto Exacto', quantity: 1, reason: 'Golpeado' });
    assert.strictEqual(exacto.status, 201);
    assert.strictEqual(exacto.body.material_id, mat.id);

    const parcial = await api('post', '/mermas', { material: 'Tomate', quantity: 1, reason: 'Golpeado' });
    assert.strictEqual(parcial.status, 404);
    assert.strictEqual(parcial.body.message, "Material 'Tomate' no encontrado.");
    assert.strictEqual(await stockDe(mat.id), 4);
  });

  it('una merma mayor al stock responde 409 y no registra nada', async () => {
    const mat = await crearMaterial({ stock: 3 });
    const antes = await pool.query('SELECT COUNT(*)::int AS n FROM mermas;');
    const res = await api('post', '/mermas', { material_id: mat.id, quantity: 3.5, reason: 'Vencido' });
    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /^Stock insuficiente/);
    const despues = await pool.query('SELECT COUNT(*)::int AS n FROM mermas;');
    assert.strictEqual(despues.rows[0].n, antes.rows[0].n);
    assert.strictEqual(await stockDe(mat.id), 3);
    assert.strictEqual((await movimientosDe(mat.id)).length, 1);
  });
});

describe('Inventario: recetas', () => {
  let pollo: { id: string };
  let arroz: { id: string };
  let recetaId: string;

  beforeAll(async () => {
    pollo = await crearMaterial({ name: 'Pollo receta', costo_unitario: 14000 });
    arroz = await crearMaterial({ name: 'Arroz receta', costo_unitario: 3800 });
  });

  it('crea una receta con costo calculado en el backend y margen', async () => {
    const res = await api('post', '/recetas', {
      name: 'Bandeja de prueba',
      price: 5000,
      ingredients: [
        { material_id: pollo.id, cantidad: 0.25 },
        { material_id: arroz.id, cantidad: 0.125 },
      ],
    });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    recetaId = res.body.id;
    // 0.25 * 14000 = 3500 ; 0.125 * 3800 = 475
    assert.strictEqual(res.body.cost, 3975);
    assert.strictEqual(res.body.margen, 1025);
    assert.match(res.body.code, /^REC-\d{3}$/);

    const lista = await api('get', '/recetas');
    const receta = lista.body.find((r: { id: string }) => r.id === recetaId);
    assert.strictEqual(receta.margen_pct, 20.5);
    const ingArroz = receta.ingredients.find((i: { material_id: string }) => i.material_id === arroz.id);
    assert.strictEqual(ingArroz.cantidad, 0.125);
    assert.strictEqual(ingArroz.cost, 475);
  });

  it('ignora el costo que mande el cliente', async () => {
    const res = await api('post', '/recetas', {
      name: 'Receta con costo falso',
      price: 5000,
      cost: 1,
      ingredients: [{ material_id: pollo.id, cantidad: 1, costo: 1 }],
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.cost, 14000);
  });

  it('PUT reemplaza ingredientes y recalcula', async () => {
    const res = await api('put', `/recetas/${recetaId}`, {
      name: 'Bandeja de prueba',
      price: 6000,
      ingredients: [{ material_id: pollo.id, cantidad: 0.3 }],
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.cost, 4200);
    assert.strictEqual(res.body.margen, 1800);
  });

  it('valida ingredientes: material repetido, inexistente o con más de 3 decimales', async () => {
    const repetido = await api('post', '/recetas', {
      name: 'Mala',
      price: 1000,
      ingredients: [
        { material_id: pollo.id, cantidad: 1 },
        { material_id: pollo.id, cantidad: 2 },
      ],
    });
    assert.strictEqual(repetido.status, 400);
    assert.match(repetido.body.message, /no puede repetirse/);

    const inexistente = await api('post', '/recetas', {
      name: 'Mala',
      price: 1000,
      ingredients: [{ material_id: randomUUID(), cantidad: 1 }],
    });
    assert.strictEqual(inexistente.status, 404);

    const decimales = await api('post', '/recetas', {
      name: 'Mala',
      price: 1000,
      ingredients: [{ material_id: pollo.id, cantidad: 0.1255 }],
    });
    assert.strictEqual(decimales.status, 400);
    assert.match(decimales.body.message, /máximo 3 decimales/);
  });

  it('cambiar el costo de un material por edición recalcula las recetas que lo usan', async () => {
    const res = await api('patch', `/materiales/${pollo.id}`, { costo_unitario: 15000 });
    assert.strictEqual(res.status, 200);
    const receta = await pool.query('SELECT costo_produccion::float8 AS costo FROM recetas WHERE id = $1;', [recetaId]);
    assert.strictEqual(receta.rows[0].costo, 4500); // 0.3 * 15000
  });

  it('una entrada con costo nuevo recalcula las recetas en la misma operación', async () => {
    const res = await api('post', `/materiales/${pollo.id}/entradas`, { cantidad: 2, costo_unitario: 16000 });
    assert.strictEqual(res.status, 201);
    const receta = await pool.query('SELECT costo_produccion::float8 AS costo FROM recetas WHERE id = $1;', [recetaId]);
    assert.strictEqual(receta.rows[0].costo, 4800); // 0.3 * 16000
  });

  it('DELETE responde 409 si una receta activa usa el material', async () => {
    const res = await api('delete', `/materiales/${pollo.id}`);
    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /Bandeja de prueba/);
    const activo = await pool.query('SELECT activo FROM materiales WHERE id = $1;', [pollo.id]);
    assert.strictEqual(activo.rows[0].activo, true);
  });

  it('DELETE hace borrado lógico si ninguna receta activa lo usa y conserva el kardex', async () => {
    const mat = await crearMaterial();
    const res = await api('delete', `/materiales/${mat.id}`);
    assert.strictEqual(res.status, 200);
    const fila = await pool.query('SELECT activo FROM materiales WHERE id = $1;', [mat.id]);
    assert.strictEqual(fila.rows[0].activo, false);
    assert.strictEqual((await movimientosDe(mat.id)).length, 1);

    const lista = await api('get', '/materiales');
    assert.ok(!lista.body.some((m: { id: string }) => m.id === mat.id));
    const otraVez = await api('delete', `/materiales/${mat.id}`);
    assert.strictEqual(otraVez.status, 404);
  });
});

describe('Inventario: filtros del kardex', () => {
  let materialId: string;

  beforeAll(async () => {
    const mat = await pool.query(
      `INSERT INTO materiales (codigo_barras, nombre, unidad_medida, stock_actual)
       VALUES ('KARDEX-TZ', 'Material zona horaria', 'Kg', 7) RETURNING id;`
    );
    materialId = mat.rows[0].id;
    // 27-oct 11:30 PM en Bogotá = 28-oct 04:30 UTC
    await pool.query(
      `INSERT INTO movimientos_kardex (material_id, fecha_hora, tipo, concepto, cantidad_entrada, saldo_resultante)
       VALUES ($1, '2026-10-27 23:30:00-05', 'entrada', 'Noche del 27', 10, 10);`,
      [materialId]
    );
    await pool.query(
      `INSERT INTO movimientos_kardex (material_id, fecha_hora, tipo, concepto, cantidad_salida, saldo_resultante)
       VALUES ($1, '2026-10-28 00:30:00-05', 'salida', 'Madrugada del 28', 3, 7);`,
      [materialId]
    );
  });

  it('"hasta" incluye todo el día en hora de Bogotá', async () => {
    const res = await api('get', `/kardex?material_id=${materialId}&hasta=2026-10-27`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.items.map((i: { concepto: string }) => i.concepto), ['Noche del 27']);
    assert.strictEqual(res.body.items[0].date, '27/10/2026 11:30 PM');
  });

  it('"desde" empieza a la medianoche de Bogotá', async () => {
    const res = await api('get', `/kardex?material_id=${materialId}&desde=2026-10-28&hasta=2026-10-28`);
    assert.deepStrictEqual(res.body.items.map((i: { concepto: string }) => i.concepto), ['Madrugada del 28']);
    assert.strictEqual(res.body.items[0].date, '28/10/2026 12:30 AM');
  });

  it('filtra por tipo y devuelve saldo y cantidades decimales', async () => {
    const res = await api('get', `/kardex?material_id=${materialId}&tipo=salida`);
    assert.strictEqual(res.body.total, 1);
    assert.strictEqual(res.body.items[0].tipo, 'salida');
    assert.strictEqual(res.body.items[0].saldo, 7);
    assert.strictEqual(res.body.items[0].exit, '-3 Kg');
  });

  it('pagina con limit y offset, con un tope de 200', async () => {
    const pagina1 = await api('get', `/kardex?material_id=${materialId}&limit=1&offset=0`);
    const pagina2 = await api('get', `/kardex?material_id=${materialId}&limit=1&offset=1`);
    assert.strictEqual(pagina1.body.total, 2);
    assert.strictEqual(pagina1.body.items[0].concepto, 'Madrugada del 28');
    assert.strictEqual(pagina2.body.items[0].concepto, 'Noche del 27');

    const tope = await api('get', '/kardex?limit=1000');
    assert.strictEqual(tope.body.limit, 200);
  });

  it('rechaza filtros inválidos con 400', async () => {
    assert.strictEqual((await api('get', '/kardex?tipo=robo')).status, 400);
    assert.strictEqual((await api('get', '/kardex?desde=2026-13-01')).status, 400);
    assert.strictEqual((await api('get', '/kardex?material_id=abc')).status, 400);
    assert.strictEqual((await api('get', '/kardex?offset=-1')).status, 400);
  });
});
