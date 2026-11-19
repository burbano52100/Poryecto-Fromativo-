import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase, restablecerConfiguracion } from './helpers/db.js';
import { crearUsuario, crearFicha, crearMenu, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';
import { fechaRelativa } from './helpers/fechas.js';

const app = createApp();

let encargado: UsuarioTest;
let instructor: UsuarioTest;
const aprendices: UsuarioTest[] = [];

const api = (method: 'get' | 'post' | 'patch', path: string, token = encargado.token) =>
  request(app)[method](`/api/beneficiarios${path}`).set('Authorization', `Bearer ${token}`);

const alta = (usuario: UsuarioTest, extra: Record<string, unknown> = {}) =>
  api('post', '').send({ usuario_id: usuario.id, sin_apoyo_incompatible: true, ...extra });

const fijarCupo = (cupo: number) =>
  pool.query("UPDATE configuracion SET valor = $1::jsonb WHERE clave = 'beneficiarios_cupo_maximo';", [JSON.stringify(cupo)]);

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  const fichaId = await crearFicha('2847251');
  encargado = await crearUsuario('Encargado', '8100000001', 'encargado');
  instructor = await crearUsuario('Instructor', '8100000004', 'instructor');
  for (const [i, nombre] of ['Ana', 'Bruno', 'Carla', 'David', 'Elena'].entries()) {
    aprendices.push(await crearUsuario(`${nombre} Aprendiz`, `810000001${i}`, 'aprendiz', { fichaId }));
  }
});

beforeEach(async () => {
  fijarHoraBogota(12);
  await pool.query('TRUNCATE TABLE beneficios, alertas, ventas, menus_dia RESTART IDENTITY CASCADE;');
  await pool.query('UPDATE usuarios SET es_beneficiario = false;');
  await restablecerConfiguracion();
});

afterAll(() => restaurarReloj());

describe('Permisos y validaciones', () => {
  it('solo el encargado gestiona beneficiarios', async () => {
    assert.strictEqual((await api('get', '', aprendices[0].token)).status, 403);
    assert.strictEqual((await api('get', '/estudiantes', instructor.token)).status, 403);
    assert.strictEqual((await request(app).get('/api/beneficiarios')).status, 401);
  });

  it('exige la confirmación de que no recibe otro apoyo incompatible', async () => {
    const res = await api('post', '').send({ usuario_id: aprendices[0].id });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /otro apoyo incompatible/);
  });

  it('valida las fechas y que sea un aprendiz', async () => {
    assert.strictEqual((await alta(aprendices[0], { fecha_inicio: fechaRelativa(1) })).status, 400);
    assert.strictEqual((await alta(aprendices[0], { fecha_inicio: fechaRelativa(-5), fecha_fin: fechaRelativa(-6) })).status, 400);
    assert.strictEqual((await alta(instructor)).status, 404);
  });
});

describe('Alta, cupo y lista de espera', () => {
  it('con cupo queda activo: es_beneficiario se sincroniza y reserva a $0 con un clic', async () => {
    const res = await alta(aprendices[0], { fecha_fin: fechaRelativa(30), prioridad: 2 });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.beneficio.estado, 'activo');
    const usuario = await pool.query('SELECT es_beneficiario FROM usuarios WHERE id = $1;', [aprendices[0].id]);
    assert.strictEqual(usuario.rows[0].es_beneficiario, true);

    await crearMenu('Menú del día');
    const reserva = await request(app).post('/api/consumos/reservar').set('Authorization', `Bearer ${aprendices[0].token}`).send({});
    assert.strictEqual(reserva.status, 201, JSON.stringify(reserva.body));
    assert.strictEqual(reserva.body.precio, 0);

    assert.strictEqual((await alta(aprendices[0])).status, 409, 'no se da de alta dos veces');
    const auditoria = await pool.query("SELECT 1 FROM auditoria WHERE entidad = 'beneficio' AND accion = 'crear';");
    assert.ok(auditoria.rowCount! >= 1);
  });

  it('con el cupo lleno entra a la lista de espera ordenada por prioridad y fecha', async () => {
    await fijarCupo(2);
    await alta(aprendices[0]);
    await alta(aprendices[1]);
    const carla = await alta(aprendices[2], { prioridad: 3 });
    const david = await alta(aprendices[3], { prioridad: 1 });
    const elena = await alta(aprendices[4], { prioridad: 3 });
    assert.strictEqual(carla.body.beneficio.estado, 'en_espera');
    assert.match(carla.body.message, /lista de espera/);

    const lista = await api('get', '?estado=en_espera');
    assert.deepStrictEqual(
      lista.body.items.map((b: any) => [b.nombre, b.posicion_espera]),
      [
        ['David Aprendiz', 1],
        ['Carla Aprendiz', 2],
        ['Elena Aprendiz', 3],
      ]
    );
    assert.deepStrictEqual(lista.body.cupo, { cupo: 2, activos: 2, disponibles: 0 });
    assert.strictEqual(lista.body.sugerido, null, 'sin cupo libre no sugiere a nadie');

    // Sin cupo no se puede activar a nadie de la lista
    assert.strictEqual((await api('post', `/${david.body.beneficio.id}/activar`)).status, 409);
    assert.ok(elena.body.beneficio.id);
  });

  it('al finalizar un activo se libera el cupo, se sugiere al primero de la lista y el encargado confirma', async () => {
    await fijarCupo(1);
    const ana = await alta(aprendices[0]);
    await alta(aprendices[2], { prioridad: 2 });
    const david = await alta(aprendices[3], { prioridad: 1 });

    const sinMotivo = await api('post', `/${ana.body.beneficio.id}/finalizar`).send({ motivo: 'otro' });
    assert.strictEqual(sinMotivo.status, 400, '"otro" exige detalle');

    const fin = await api('post', `/${ana.body.beneficio.id}/finalizar`).send({ motivo: 'inasistencias' });
    assert.strictEqual(fin.status, 200, JSON.stringify(fin.body));
    assert.strictEqual(fin.body.sugerido.nombre, 'David Aprendiz');
    const alerta = await pool.query("SELECT mensaje FROM alertas WHERE tipo = 'cupo_liberado';");
    assert.match(alerta.rows[0].mensaje, /David Aprendiz/);

    const lista = await api('get', '');
    assert.strictEqual(lista.body.sugerido.beneficio_id, david.body.beneficio.id);

    const activar = await api('post', `/${david.body.beneficio.id}/activar`);
    assert.strictEqual(activar.status, 200, JSON.stringify(activar.body));
    assert.strictEqual(activar.body.beneficio.estado, 'activo');
    const historial = await api('get', `/historial/${aprendices[0].id}`);
    assert.strictEqual(historial.body[0].motivo_fin, 'inasistencias');
    assert.strictEqual(historial.body[0].motivo_fin_texto, 'Inasistencias');
  });

  it('el beneficio termina solo al pasar su fecha de fin y avisa al encargado', async () => {
    const res = await alta(aprendices[1], { fecha_inicio: fechaRelativa(-10), fecha_fin: fechaRelativa(0) });
    assert.strictEqual(res.status, 201);
    // Simula que la fecha de fin ya pasó (ayer)
    await pool.query('UPDATE beneficios SET fecha_fin = $1 WHERE id = $2;', [fechaRelativa(-1), res.body.beneficio.id]);

    const lista = await api('get', '?estado=todos');
    const beneficio = lista.body.items.find((b: any) => b.id === res.body.beneficio.id);
    assert.strictEqual(beneficio.estado, 'finalizado');
    assert.strictEqual(beneficio.motivo_fin, 'fecha_cumplida');
    const usuario = await pool.query('SELECT es_beneficiario FROM usuarios WHERE id = $1;', [aprendices[1].id]);
    assert.strictEqual(usuario.rows[0].es_beneficiario, false);
    const alerta = await pool.query("SELECT 1 FROM alertas WHERE tipo = 'beneficio_finalizado';");
    assert.strictEqual(alerta.rowCount, 1);
    const auditoria = await pool.query("SELECT rol FROM auditoria WHERE entidad = 'beneficio' AND accion = 'finalizar';");
    assert.strictEqual(auditoria.rows[0].rol, 'sistema');
  });

  it('cambiar la prioridad o la fecha de fin queda auditado', async () => {
    const res = await alta(aprendices[2]);
    const editar = await api('patch', `/${res.body.beneficio.id}`).send({ prioridad: 5, fecha_fin: fechaRelativa(15) });
    assert.strictEqual(editar.status, 200);
    assert.strictEqual(editar.body.beneficio.prioridad, 5);
    const auditoria = await pool.query("SELECT datos_antes, datos_despues FROM auditoria WHERE entidad = 'beneficio' AND accion = 'editar';");
    assert.strictEqual(auditoria.rows[0].datos_despues.prioridad, 5);
  });
});
