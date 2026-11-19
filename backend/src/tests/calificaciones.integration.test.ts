import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, crearMenu, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';

const app = createApp();

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;
let instructor: UsuarioTest;
let sinReserva: UsuarioTest;
let menuHoy: string;

const auth = (u: UsuarioTest) => ({ Authorization: `Bearer ${u.token}` });
const calificar = (u: UsuarioTest, body: object) => request(app).post('/api/calificaciones').set(auth(u)).send(body);

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  encargado = await crearUsuario('Encargado', '8600000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz Calificador', '8600000002', 'aprendiz');
  instructor = await crearUsuario('Instructor Calificador', '8600000003', 'instructor');
  sinReserva = await crearUsuario('Sin Reserva', '8600000004', 'aprendiz');
  menuHoy = await crearMenu('Bandeja del día');
  for (const u of [aprendiz, instructor]) {
    assert.strictEqual((await request(app).post('/api/consumos/reservar').set(auth(u)).send({})).status, 201);
  }
});

afterAll(() => restaurarReloj());

describe('Calificación del almuerzo', () => {
  it('solo califica quien reservó el almuerzo de hoy', async () => {
    const estado = await request(app).get('/api/calificaciones/hoy').set(auth(sinReserva));
    assert.strictEqual(estado.body.puede_calificar, false);
    const res = await calificar(sinReserva, { menu_id: menuHoy, estrellas: 5 });
    assert.strictEqual(res.status, 403);
  });

  it('valida las estrellas (1 a 5) y el comentario (máximo 300)', async () => {
    assert.strictEqual((await calificar(aprendiz, { menu_id: menuHoy, estrellas: 6 })).status, 400);
    assert.strictEqual((await calificar(aprendiz, { menu_id: menuHoy, estrellas: 0 })).status, 400);
    assert.strictEqual((await calificar(aprendiz, { menu_id: menuHoy, estrellas: 4, comentario: 'x'.repeat(301) })).status, 400);
  });

  it('es única por día: la segunda vez responde 409 y se puede editar el mismo día', async () => {
    const primera = await calificar(aprendiz, { menu_id: menuHoy, estrellas: 2, comentario: 'La sopa llegó fría' });
    assert.strictEqual(primera.status, 201, JSON.stringify(primera.body));
    const segunda = await calificar(aprendiz, { menu_id: menuHoy, estrellas: 5 });
    assert.strictEqual(segunda.status, 409);

    const editar = await request(app)
      .put(`/api/calificaciones/${primera.body.calificacion.id}`)
      .set(auth(aprendiz))
      .send({ estrellas: 3, comentario: 'Mejoró después' });
    assert.strictEqual(editar.status, 200);
    assert.strictEqual(editar.body.calificacion.estrellas, 3);

    const hoy = await request(app).get('/api/calificaciones/hoy').set(auth(aprendiz));
    assert.strictEqual(hoy.body.calificacion.estrellas, 3);

    // Nadie más puede editarla
    const ajena = await request(app).put(`/api/calificaciones/${primera.body.calificacion.id}`).set(auth(instructor)).send({ estrellas: 1 });
    assert.strictEqual(ajena.status, 404);
  });

  it('después del día del almuerzo ya no se puede editar', async () => {
    const res = await calificar(instructor, { menu_id: menuHoy, estrellas: 1, comentario: 'Muy salado' });
    assert.strictEqual(res.status, 201);
    await pool.query("UPDATE menus_dia SET fecha = fecha - 1 WHERE id = $1;", [menuHoy]);
    const editar = await request(app).put(`/api/calificaciones/${res.body.calificacion.id}`).set(auth(instructor)).send({ estrellas: 4 });
    await pool.query("UPDATE menus_dia SET fecha = fecha + 1 WHERE id = $1;", [menuHoy]);
    assert.strictEqual(editar.status, 409);
  });

  it('el encargado ve promedio, distribución y comentarios anónimos con las bajas destacadas', async () => {
    const res = await request(app).get('/api/calificaciones').set(auth(encargado));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.resumen.total, 2);
    assert.strictEqual(res.body.resumen.promedio, 2);
    assert.strictEqual(res.body.resumen.bajas, 1);
    assert.deepStrictEqual(
      res.body.distribucion.map((d: any) => d.total),
      [1, 0, 1, 0, 0]
    );
    assert.strictEqual(res.body.por_dia.length, 1);
    const texto = JSON.stringify(res.body);
    assert.ok(!texto.includes('Calificador') && !texto.includes('usuario_id'), 'no revela quién calificó');
    assert.ok(res.body.comentarios.find((c: any) => c.estrellas === 1).baja);

    assert.strictEqual((await request(app).get('/api/calificaciones').set(auth(aprendiz))).status, 403);
  });
});
