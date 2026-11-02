import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, crearFicha, type UsuarioTest } from './helpers/auth.js';

const app = createApp();

let aprendiz: UsuarioTest;

const actualizar = (body: object, token = aprendiz.token) =>
  request(app).patch('/api/perfil').set('Authorization', `Bearer ${token}`).send(body);

beforeAll(async () => {
  await cleanDatabase();
  const fichaId = await crearFicha('2847251');
  aprendiz = await crearUsuario('Aprendiz Perfil', '8600000001', 'aprendiz', {
    fichaId,
    email: 'viejo@misena.edu.co',
  });
  await crearUsuario('Otro Aprendiz', '8600000002', 'aprendiz', { email: 'ocupado@misena.edu.co' });
});

describe('PATCH /api/perfil (correo institucional)', () => {
  it('guarda el correo institucional y conserva la ficha', async () => {
    const res = await actualizar({ email: 'nuevo@misena.edu.co' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, 'nuevo@misena.edu.co');
    assert.strictEqual(res.body.user.ficha, '2847251');

    const db = await pool.query('SELECT email FROM usuarios WHERE id = $1;', [aprendiz.id]);
    assert.strictEqual(db.rows[0].email, 'nuevo@misena.edu.co');
  });

  it('rechaza con 409 un correo que ya usa otro usuario', async () => {
    const res = await actualizar({ email: 'ocupado@misena.edu.co' });
    assert.strictEqual(res.status, 409);
  });

  it('rechaza con 400 un correo inválido', async () => {
    const res = await actualizar({ email: 'no-es-correo' });
    assert.strictEqual(res.status, 400);
  });
});
