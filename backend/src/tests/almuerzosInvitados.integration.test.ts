import { describe, it, beforeAll, beforeEach } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { fechaBogota } from '../utils/horario.js';
import { MAX_PERSONAS_POR_REGISTRO, TARIFAS_ALMUERZO_INVITADO } from '../config/almuerzosInvitados.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';

const app = createApp();
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;
const RUTA = '/api/almuerzos-invitados';

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;
let instructor: UsuarioTest;

const api = (method: 'get' | 'post' | 'put' | 'delete', path = '', token = encargado.token) =>
  request(app)[method](`${RUTA}${path}`).set('Authorization', `Bearer ${token}`);

/** 'YYYY-MM-DD' de hace `dias` días en Colombia. */
const haceDias = (dias: number): string => fechaBogota(new Date(Date.now() - dias * 86_400_000));

/** Instante de una hora de Colombia ('YYYY-MM-DD', 'HH:mm'). */
const enBogota = (fecha: string, hora: string): Date => new Date(Date.parse(`${fecha}T${hora}:00Z`) + OFFSET_BOGOTA_MS);

/** Inserta un registro directo en la BD (para fijar fecha y precio). */
const insertar = async (tipo: string, cantidad: number, fechaHora: Date, precio = TARIFAS_ALMUERZO_INVITADO.aprendiz) =>
  (
    await pool.query(
      `INSERT INTO almuerzos_invitados (tipo, cantidad, precio_unitario, registrado_por, fecha_hora)
       VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
      [tipo, cantidad, precio, encargado.id, fechaHora]
    )
  ).rows[0].id as string;

beforeAll(async () => {
  await cleanDatabase();
  encargado = await crearUsuario('Encargada Comedor', '8800000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz Curioso', '8800000002', 'aprendiz');
  instructor = await crearUsuario('Instructor Curioso', '8800000003', 'instructor');
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE almuerzos_invitados;');
});

describe('Acceso a Almuerzos Invitados', () => {
  it('solo el encargado entra: los demás roles reciben 403 y sin token 401', async () => {
    for (const usuario of [aprendiz, instructor]) {
      assert.strictEqual((await api('get', '', usuario.token)).status, 403);
      assert.strictEqual((await api('get', '/resumen', usuario.token)).status, 403);
      assert.strictEqual((await api('post', '', usuario.token).send({ tipo: 'aprendiz', cantidad: 1 })).status, 403);
    }
    assert.strictEqual((await request(app).get(RUTA)).status, 401);
    assert.strictEqual((await pool.query('SELECT count(*)::int AS n FROM almuerzos_invitados;')).rows[0].n, 0);
  });
});

describe('GET /api/almuerzos-invitados/tarifas', () => {
  it('devuelve las tres tarifas fijas y el máximo de personas', async () => {
    const res = await api('get', '/tarifas');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      tarifas: [
        { tipo: 'instructor', precio: 10000 },
        { tipo: 'aprendiz', precio: 5000 },
        { tipo: 'corriente', precio: 11000 },
      ],
      maxPersonas: MAX_PERSONAS_POR_REGISTRO,
    });
  });
});

describe('POST /api/almuerzos-invitados', () => {
  it('registra personas × tarifa con el encargado y la hora actual; ignora el precio del cliente', async () => {
    const antes = Date.now();
    const res = await api('post').send({ tipo: 'instructor', cantidad: 4, nombre_invitado: '  Delegación Neiva  ', precio_unitario: 1 });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.tipo, 'instructor');
    assert.strictEqual(res.body.cantidad, 4);
    assert.strictEqual(res.body.precio_unitario, 10000);
    assert.strictEqual(res.body.total, 40000);
    assert.strictEqual(res.body.nombre_invitado, 'Delegación Neiva');
    assert.deepStrictEqual(res.body.registrado_por, { id: encargado.id, nombre: 'Encargada Comedor' });
    assert.ok(Math.abs(Date.parse(res.body.fecha_hora) - antes) < 60_000);
    assert.match(res.body.fecha_local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('cobra la tarifa de cada tipo', async () => {
    for (const [tipo, precio] of Object.entries(TARIFAS_ALMUERZO_INVITADO)) {
      const res = await api('post').send({ tipo, cantidad: 3 });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.total, 3 * precio);
      assert.strictEqual(res.body.nombre_invitado, null);
    }
  });

  for (const [caso, cantidad] of [
    ['cero', 0],
    ['negativa', -2],
    ['decimal', 2.5],
    ['texto', '4'],
    ['ausente', undefined],
    ['mayor al máximo', MAX_PERSONAS_POR_REGISTRO + 1],
  ] as const) {
    it(`rechaza una cantidad ${caso} con 400`, async () => {
      const res = await api('post').send({ tipo: 'aprendiz', cantidad });
      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /número de personas/);
    });
  }

  it('rechaza un tipo que no existe', async () => {
    for (const tipo of ['vip', 'invitado', '', undefined]) {
      const res = await api('post').send({ tipo, cantidad: 1 });
      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /tipo de almuerzo no es válido/);
    }
    assert.strictEqual((await pool.query('SELECT count(*)::int AS n FROM almuerzos_invitados;')).rows[0].n, 0);
  });
});

describe('GET /api/almuerzos-invitados (historial)', () => {
  it('filtra por rango de días en hora de Colombia, incluidos los bordes', async () => {
    const ayer = haceDias(1);
    const antier = haceDias(2);
    await insertar('aprendiz', 1, enBogota(antier, '23:59'));
    const dentroInicio = await insertar('aprendiz', 2, enBogota(ayer, '00:00'));
    const dentroFin = await insertar('corriente', 3, enBogota(ayer, '23:59'));
    await insertar('instructor', 4, enBogota(fechaBogota(), '00:00'));

    const res = await api('get').query({ desde: ayer, hasta: ayer });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(
      res.body.map((r: any) => r.id),
      [dentroFin, dentroInicio]
    );
    assert.strictEqual(res.body[0].fecha_local, `${ayer}T23:59`);
  });

  it('filtra por tipo y sin fechas trae solo los de hoy', async () => {
    await insertar('aprendiz', 1, new Date());
    await insertar('corriente', 2, new Date());
    await insertar('corriente', 5, enBogota(haceDias(3), '12:00'));

    const res = await api('get').query({ tipo: 'corriente' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].cantidad, 2);
  });

  it('valida las fechas y el tipo del filtro', async () => {
    assert.strictEqual((await api('get').query({ desde: '2026-02-30' })).status, 400);
    assert.strictEqual((await api('get').query({ hasta: 'ayer' })).status, 400);
    assert.strictEqual((await api('get').query({ desde: '2026-11-10', hasta: '2026-11-01' })).status, 400);
    assert.strictEqual((await api('get').query({ tipo: 'vip' })).status, 400);
  });
});

describe('GET /api/almuerzos-invitados/resumen', () => {
  it('suma personas y pesos del día y del período, por tipo y en total', async () => {
    const hace5 = haceDias(5);
    await insertar('instructor', 2, new Date(), 10000);
    await insertar('aprendiz', 3, new Date(), 5000);
    await insertar('aprendiz', 1, enBogota(hace5, '12:00'), 5000);
    await insertar('corriente', 10, enBogota(haceDias(40), '12:00'), 11000); // fuera del período

    const res = await api('get', '/resumen').query({ desde: hace5, hasta: fechaBogota() });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.hoy, fechaBogota());
    assert.deepStrictEqual(res.body.dia, {
      porTipo: {
        instructor: { personas: 2, total: 20000, registros: 1 },
        aprendiz: { personas: 3, total: 15000, registros: 1 },
        corriente: { personas: 0, total: 0, registros: 0 },
      },
      personas: 5,
      total: 35000,
      registros: 2,
    });
    assert.deepStrictEqual(res.body.periodo.porTipo.aprendiz, { personas: 4, total: 20000, registros: 2 });
    assert.strictEqual(res.body.periodo.personas, 6);
    assert.strictEqual(res.body.periodo.total, 40000);
  });
});

describe('PUT y DELETE /api/almuerzos-invitados/:id', () => {
  it('edita personas, nombre y fecha; el total usa el precio guardado, no la tarifa vigente', async () => {
    const id = await insertar('instructor', 1, new Date(), 9000); // vendido con una tarifa anterior
    const ayer = haceDias(1);

    const res = await api('put', `/${id}`).send({ cantidad: 3, nombre_invitado: 'Corrección', fecha_hora: `${ayer}T12:30` });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.cantidad, 3);
    assert.strictEqual(res.body.precio_unitario, 9000);
    assert.strictEqual(res.body.total, 27000);
    assert.strictEqual(res.body.nombre_invitado, 'Corrección');
    assert.strictEqual(res.body.fecha_local, `${ayer}T12:30`);
    assert.strictEqual(res.body.fecha_hora, enBogota(ayer, '12:30').toISOString());
  });

  it('valida la edición: personas, fecha futura o inválida, id y registro inexistente', async () => {
    const id = await insertar('aprendiz', 2, new Date());
    const manana = fechaBogota(new Date(Date.now() + 86_400_000));

    assert.strictEqual((await api('put', `/${id}`).send({ cantidad: 0, fecha_hora: `${haceDias(1)}T12:00` })).status, 400);
    const futura = await api('put', `/${id}`).send({ cantidad: 2, fecha_hora: `${manana}T12:00` });
    assert.strictEqual(futura.status, 400);
    assert.match(futura.body.message, /no puede ser futura/);
    assert.strictEqual((await api('put', `/${id}`).send({ cantidad: 2, fecha_hora: '2026-13-01T12:00' })).status, 400);
    assert.strictEqual((await api('put', '/123').send({ cantidad: 2, fecha_hora: `${haceDias(1)}T12:00` })).status, 400);
    const inexistente = await api('put', '/00000000-0000-0000-0000-000000000000').send({
      cantidad: 2,
      fecha_hora: `${haceDias(1)}T12:00`,
    });
    assert.strictEqual(inexistente.status, 404);
  });

  it('elimina un registro; la segunda vez responde 404', async () => {
    const id = await insertar('corriente', 1, new Date());
    assert.strictEqual((await api('delete', `/${id}`)).status, 200);
    assert.strictEqual((await api('delete', `/${id}`)).status, 404);
    assert.strictEqual((await pool.query('SELECT count(*)::int AS n FROM almuerzos_invitados;')).rows[0].n, 0);
  });

  it('otros roles no pueden editar ni eliminar', async () => {
    const id = await insertar('corriente', 1, new Date());
    assert.strictEqual((await api('put', `/${id}`, aprendiz.token).send({ cantidad: 2, fecha_hora: `${haceDias(1)}T12:00` })).status, 403);
    assert.strictEqual((await api('delete', `/${id}`, instructor.token)).status, 403);
  });
});

describe('Almuerzos Invitados en Ventas y en el panel del Encargado', () => {
  it('suman a los almuerzos servidos, a los ingresos cobrados y a las transacciones', async () => {
    await api('post').send({ tipo: 'instructor', cantidad: 1 });
    await api('post').send({ tipo: 'corriente', cantidad: 2, nombre_invitado: 'Proveedor' });

    const ventas = await request(app).get('/api/ventas?period=Día').set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(ventas.status, 200);
    assert.strictEqual(ventas.body.totales.almuerzosServidos, 3);
    assert.strictEqual(ventas.body.totales.ingresosCobrados, 32000);
    assert.strictEqual(ventas.body.totales.almuerzosInvitados, 3);
    assert.strictEqual(ventas.body.totales.ingresosInvitados, 32000);
    // Distinguidos por tipo, con los tres tipos siempre presentes
    assert.deepStrictEqual(ventas.body.totales.invitadosPorTipo, {
      instructor: { personas: 1, ingresos: 10000 },
      aprendiz: { personas: 0, ingresos: 0 },
      corriente: { personas: 2, ingresos: 22000 },
    });
    assert.strictEqual(ventas.body.breakdown.at(-1).count, 3);
    assert.strictEqual(ventas.body.breakdown.at(-1).invitados, 3);
    assert.strictEqual(ventas.body.breakdown.at(-1).ingresos, 32000);
    const transaccion = ventas.body.transacciones.find((t: any) => t.rol === 'corriente');
    assert.strictEqual(transaccion.origen, 'invitado');
    assert.strictEqual(transaccion.rol, 'corriente');
    assert.strictEqual(transaccion.personas, 2);
    assert.strictEqual(transaccion.precio, 22000);
    assert.strictEqual(transaccion.cliente, 'Proveedor');
    assert.strictEqual(transaccion.estado_pago, 'pagado');

    const panel = await request(app).get('/api/dashboard/encargado').set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(panel.body.ventasHoy, 3);
    assert.strictEqual(panel.body.invitadosHoy, 3);
    assert.strictEqual(panel.body.ingresosHoy, 32000);
    assert.strictEqual(panel.body.ingresosInvitadosHoy, 32000);
  });
});
