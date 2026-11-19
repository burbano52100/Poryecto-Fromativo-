import { describe, it, beforeAll, afterEach } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { fechaRelativa } from './helpers/fechas.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';
import { TARIFAS_ALMUERZO_INVITADO } from '../config/almuerzosInvitados.js';

const PRECIO_POR_DEFECTO = TARIFAS_ALMUERZO_INVITADO.corriente;

const app = createApp();

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;

const api = (method: 'get' | 'post' | 'patch', path: string, token = encargado.token) =>
  request(app)[method](`/api/visitas${path}`).set('Authorization', `Bearer ${token}`);

const EN_4_DIAS = fechaRelativa(4);

const visitaValida = {
  institucionNombre: 'Colegio Prueba',
  responsableNombre: 'Instructora Guía',
  cantidad_personas: 25,
  fecha_visita: EN_4_DIAS,
};

beforeAll(async () => {
  await cleanDatabase();
  encargado = await crearUsuario('Encargado Visitas', '7300000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz Visitas', '7300000003', 'aprendiz');
});

describe('Visitas institucionales', () => {
  it('solo el encargado las gestiona', async () => {
    assert.strictEqual((await api('get', '', aprendiz.token)).status, 403);
    assert.strictEqual((await api('post', '', aprendiz.token).send(visitaValida)).status, 403);
  });

  it('registra una visita con institución y responsable escritos a mano y el precio por defecto', async () => {
    const res = await api('post', '').send({
      ...visitaValida,
      institucionNombre: '  Colegio Prueba  ',
      responsableNombre: '  Instructora Guía ',
    });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.institucion_nombre, 'Colegio Prueba');
    assert.strictEqual(res.body.responsable_nombre, 'Instructora Guía');
    assert.strictEqual(res.body.precio_unitario, PRECIO_POR_DEFECTO);
    assert.strictEqual(res.body.total_a_cobrar, 25 * PRECIO_POR_DEFECTO);
    assert.strictEqual(res.body.fecha_visita, EN_4_DIAS);
  });

  it('el total sigue siendo personas × precio cuando se envía un precio', async () => {
    const res = await api('post', '').send({ ...visitaValida, cantidad_personas: 3, precio_unitario: 9000, fecha_visita: fechaRelativa(2) });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.total_a_cobrar, 27000);
  });

  it('la lista trae los nombres tal como se escribieron, la fecha como YYYY-MM-DD y los montos como número', async () => {
    const res = await api('get', '');
    assert.strictEqual(res.status, 200);
    const [visita] = res.body;
    assert.strictEqual(visita.institucion_nombre, 'Colegio Prueba');
    assert.strictEqual(visita.responsable_nombre, 'Instructora Guía');
    assert.strictEqual(visita.fecha_visita, EN_4_DIAS);
    assert.strictEqual(visita.total_a_cobrar, 25 * PRECIO_POR_DEFECTO);
    assert.strictEqual(visita.precio_unitario, PRECIO_POR_DEFECTO);
    assert.ok(!('institucion_id' in visita) && !('instructor_id' in visita));
  });

  for (const [campo, etiqueta, obligatorio] of [
    ['institucionNombre', 'institución', 'El nombre de la institución es obligatorio.'],
    ['responsableNombre', 'responsable', 'El nombre del responsable es obligatorio.'],
  ] as const) {
    it(`exige el nombre del ${etiqueta}: ausente, vacío o solo espacios responde 400`, async () => {
      for (const valor of [undefined, '', '    ']) {
        const res = await api('post', '').send({ ...visitaValida, [campo]: valor });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message.includes(obligatorio), res.body.message);
      }
    });

    it(`limita el nombre del ${etiqueta} a 150 caracteres`, async () => {
      assert.strictEqual((await api('post', '').send({ ...visitaValida, [campo]: 'a'.repeat(150) })).status, 201);
      const res = await api('post', '').send({ ...visitaValida, [campo]: 'a'.repeat(151) });
      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /no puede superar 150 caracteres/);
    });
  }

  it('ya no acepta los ids de institución o instructor en lugar de los nombres', async () => {
    const res = await api('post', '').send({
      institucion_id: '00000000-0000-0000-0000-000000000001',
      instructor_id: '00000000-0000-0000-0000-000000000002',
      cantidad_personas: 5,
      fecha_visita: EN_4_DIAS,
    });
    assert.strictEqual(res.status, 400);
  });

  it('rechaza una cantidad de personas no válida', async () => {
    const res = await api('post', '').send({ ...visitaValida, cantidad_personas: 0 });
    assert.strictEqual(res.status, 400);
  });

  it('la base también rechaza un nombre vacío o de más de 150 caracteres', async () => {
    const insertar = (institucion: string, responsable: string) =>
      pool.query(
        `INSERT INTO visitas_institucionales (institucion_nombre, responsable_nombre, cantidad_personas, fecha_visita, precio_unitario)
         VALUES ($1, $2, 1, CURRENT_DATE, 1000);`,
        [institucion, responsable]
      );
    await assert.rejects(insertar('   ', 'Alguien'), { code: '23514' });
    await assert.rejects(insertar('Colegio', 'b'.repeat(151)), { code: '23514' });
  });
});

describe('Fecha de la visita: no se permiten fechas anteriores a hoy (hora de Colombia)', () => {
  afterEach(() => restaurarReloj());

  it('rechaza ayer con 400 y el mensaje claro, y acepta hoy', async () => {
    const ayer = await api('post', '').send({ ...visitaValida, fecha_visita: fechaRelativa(-1) });
    assert.strictEqual(ayer.status, 400);
    assert.strictEqual(ayer.body.message, 'La fecha no puede ser anterior a hoy');

    const hoy = await api('post', '').send({ ...visitaValida, fecha_visita: fechaRelativa(0) });
    assert.strictEqual(hoy.status, 201, JSON.stringify(hoy.body));
  });

  it('a las 11:30 p. m. de Bogotá (ya es mañana en UTC) "hoy" sigue siendo el día de Bogotá', async () => {
    fijarHoraBogota(23, 30);
    const hoyBogota = fechaRelativa(0);
    assert.notStrictEqual(new Date().toISOString().slice(0, 10), hoyBogota, 'en UTC ya es el día siguiente');
    const res = await api('post', '').send({ ...visitaValida, fecha_visita: hoyBogota });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  });

  it('a las 12:05 a. m. de Bogotá el día anterior ya es pasado', async () => {
    fijarHoraBogota(0, 5);
    const res = await api('post', '').send({ ...visitaValida, fecha_visita: fechaRelativa(-1) });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message, 'La fecha no puede ser anterior a hoy');
  });

  it('rechaza una fecha que no existe', async () => {
    const res = await api('post', '').send({ ...visitaValida, fecha_visita: '2027-02-30' });
    assert.strictEqual(res.status, 400);
  });
});

describe('Marcar la visita como realizada', () => {
  /** Las visitas pasadas no se pueden crear por la API: se insertan directo, como las que ya existían. */
  const visitaPasada = async (dias: number) =>
    (
      await pool.query(
        `INSERT INTO visitas_institucionales (institucion_nombre, responsable_nombre, cantidad_personas, fecha_visita, precio_unitario)
         VALUES ('Colegio Pasado', 'Profe', 10, $1, 11000) RETURNING id;`,
        [fechaRelativa(-dias)]
      )
    ).rows[0].id as string;

  it('pasa de programada a realizada, guarda quién y cuándo, y queda en la auditoría', async () => {
    await pool.query('DELETE FROM visitas_institucionales;');
    const creada = await api('post', '').send({ ...visitaValida, institucionNombre: 'Colegio Hoy', fecha_visita: fechaRelativa(0) });
    const res = await api('patch', `/${creada.body.id}/realizada`);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.estado, 'realizada');
    assert.strictEqual(res.body.confirmada_por_nombre, 'Encargado Visitas');
    assert.ok(res.body.fecha_hora_realizada);

    const auditoria = await pool.query("SELECT datos_antes, datos_despues FROM auditoria WHERE accion = 'marcar_realizada' AND entidad_id = $1;", [
      creada.body.id,
    ]);
    assert.strictEqual(auditoria.rows[0].datos_antes.estado, 'programada');
    assert.strictEqual(auditoria.rows[0].datos_despues.estado, 'realizada');
  });

  it('si ya está realizada responde 409', async () => {
    const id = await visitaPasada(3);
    assert.strictEqual((await api('patch', `/${id}/realizada`)).status, 200);
    const otraVez = await api('patch', `/${id}/realizada`);
    assert.strictEqual(otraVez.status, 409);
  });

  it('una visita futura no se puede marcar todavía', async () => {
    const creada = await api('post', '').send({ ...visitaValida, fecha_visita: fechaRelativa(5) });
    const res = await api('patch', `/${creada.body.id}/realizada`);
    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /Solo puedes marcarla el día de la visita o después/);
  });

  it('solo el encargado puede marcarla (403) y valida el id', async () => {
    const id = await visitaPasada(1);
    assert.strictEqual((await api('patch', `/${id}/realizada`, aprendiz.token)).status, 403);
    assert.strictEqual((await api('patch', '/no-es-uuid/realizada')).status, 400);
    assert.strictEqual((await api('patch', '/00000000-0000-0000-0000-000000000000/realizada')).status, 404);
  });

  it('las tarjetas cuentan solo las realizadas del mes y aparte las programadas pendientes', async () => {
    await pool.query('DELETE FROM visitas_institucionales;');
    const realizada = await api('post', '').send({ ...visitaValida, cantidad_personas: 4, precio_unitario: 10000, fecha_visita: fechaRelativa(0) });
    await api('patch', `/${realizada.body.id}/realizada`);
    await api('post', '').send({ ...visitaValida, cantidad_personas: 30, fecha_visita: fechaRelativa(0) });

    const kpi = await api('get', '/kpi');
    assert.strictEqual(kpi.status, 200);
    assert.strictEqual(kpi.body.totalVisitasMes, 1);
    assert.strictEqual(kpi.body.totalPersonasAtendidas, 4);
    assert.strictEqual(kpi.body.ingresosVisitas, 40000);
    assert.strictEqual(kpi.body.programadasPendientes, 1);
  });

  it('el precio por persona y el total quedan guardados en la visita', async () => {
    const res = await api('post', '').send({ ...visitaValida, cantidad_personas: 2, precio_unitario: 7000 });
    const fila = await pool.query('SELECT precio_unitario::float8 AS p, total_a_cobrar::float8 AS t FROM visitas_institucionales WHERE id = $1;', [
      res.body.id,
    ]);
    assert.deepStrictEqual(fila.rows[0], { p: 7000, t: 14000 });
  });
});
