import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';

const app = createApp();

let encargado: UsuarioTest;
let instructor: UsuarioTest;
let aprendiz: UsuarioTest;
let institucionId: string;

const api = (method: 'get' | 'post', path: string, token = encargado.token) =>
  request(app)[method](`/api/visitas${path}`).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  await cleanDatabase();
  encargado = await crearUsuario('Encargado Visitas', '7300000001', 'encargado');
  instructor = await crearUsuario('Instructora Guía', '7300000002', 'instructor');
  aprendiz = await crearUsuario('Aprendiz Visitas', '7300000003', 'aprendiz');
  institucionId = (
    await pool.query(
      "INSERT INTO instituciones (nombre, tipo, ciudad, activo) VALUES ('Colegio Prueba', 'colegio', 'Pitalito', true) RETURNING id"
    )
  ).rows[0].id;
});

describe('Visitas institucionales', () => {
  it('solo el encargado las gestiona', async () => {
    assert.strictEqual((await api('get', '', aprendiz.token)).status, 403);
  });

  it('registra una visita con instructor interno y precio de invitado por defecto', async () => {
    const res = await api('post', '').send({
      institucion_id: institucionId,
      instructor_id: instructor.id,
      cantidad_personas: 25,
      fecha_visita: '2026-11-20',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.total_a_cobrar, 25 * 8000);
  });

  it('la lista trae la fecha como YYYY-MM-DD, los montos como número y el nombre del instructor', async () => {
    const res = await api('get', '');
    assert.strictEqual(res.status, 200);
    const [visita] = res.body;
    assert.strictEqual(visita.fecha_visita, '2026-11-20');
    assert.strictEqual(visita.total_a_cobrar, 200000);
    assert.strictEqual(visita.precio_unitario, 8000);
    assert.strictEqual(visita.instructor_nombre, 'Instructora Guía');
    assert.strictEqual(visita.institucion_nombre, 'Colegio Prueba');
  });

  it('rechaza una cantidad de personas no válida', async () => {
    const res = await api('post', '').send({ institucion_id: institucionId, cantidad_personas: 0, fecha_visita: '2026-11-20' });
    assert.strictEqual(res.status, 400);
  });
});
