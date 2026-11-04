import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';

// Archivo propio: el contador del limitador vive en memoria y no debe mezclarse con otros tests
const app = createApp();
const PASSWORD = 'clave-segura-123';
const login = (password: string) => request(app).post('/api/auth/login').send({ document: '7100000001', password });

beforeAll(async () => {
  await cleanDatabase();
  await pool.query(
    `INSERT INTO usuarios (nombre, cedula, password_hash, rol, activo)
     VALUES ('Aprendiz Limite', '7100000001', $1, 'aprendiz', true);`,
    [await bcrypt.hash(PASSWORD, 4)]
  );
});

describe('Rate limit del login', () => {
  it('los ingresos exitosos no cuentan: 20 seguidos desde la misma IP funcionan', async () => {
    for (let i = 0; i < 20; i++) {
      assert.strictEqual((await login(PASSWORD)).status, 200, `ingreso ${i + 1}`);
    }
  });

  it('después de 15 intentos fallidos responde 429', async () => {
    for (let i = 0; i < 15; i++) {
      assert.strictEqual((await login('clave-incorrecta')).status, 401, `intento ${i + 1}`);
    }
    const bloqueado = await login('clave-incorrecta');
    assert.strictEqual(bloqueado.status, 429);
    assert.match(bloqueado.body.message, /intentos fallidos/);
  });
});
