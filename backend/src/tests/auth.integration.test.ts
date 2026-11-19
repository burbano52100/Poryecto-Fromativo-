import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearFicha } from './helpers/auth.js';

const app = createApp();
const PASSWORD = 'clave-segura-123';

const login = (body: object) => request(app).post('/api/auth/login').send(body);

beforeAll(async () => {
  if (process.env.DATABASE_URL_TEST === process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST must differ from DATABASE_URL for safety');
  }
  await cleanDatabase();

  const hash = await bcrypt.hash(PASSWORD, 10);
  const fichaId = await crearFicha('2847251');
  await pool.query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, ficha_id, es_beneficiario, estado)
     VALUES ('Aprendiz Login', '7000000001', 'aprendiz@misena.edu.co', $1, 'aprendiz', $2, true, 'activo'),
            ('Encargado Login', '7000000002', 'encargado@sena.edu.co', $1, 'encargado', NULL, false, 'activo'),
            ('Aprendiz Inactivo', '7000000003', NULL, $1, 'aprendiz', NULL, false, 'inactivo'),
            ('Instructor Pendiente', '7000000004', NULL, $1, 'instructor', NULL, false, 'pendiente');`,
    [hash, fichaId]
  );
  await pool.query(
    `INSERT INTO usuarios (nombre, cedula, password_hash, rol, estado, motivo_rechazo)
     VALUES ('Instructor Rechazado', '7000000005', $1, 'instructor', 'rechazado', 'No es instructor del centro');`,
    [hash]
  );
});

describe('POST /api/auth/login', () => {
  it('inicia sesión solo con documento y contraseña y toma el rol de la BD', async () => {
    const res = await login({ document: '7000000002', password: PASSWORD });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'encargado');

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET as string) as { role: string };
    assert.strictEqual(payload.role, 'encargado');
  });

  it('devuelve la ficha y el estado de beneficiario del aprendiz', async () => {
    const res = await login({ document: '7000000001', password: PASSWORD });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'aprendiz');
    assert.strictEqual(res.body.user.ficha, '2847251');
    assert.strictEqual(res.body.user.es_beneficiario, true);
  });

  it('ignora un accountType enviado por el cliente: el rol sigue saliendo de la BD', async () => {
    const res = await login({ document: '7000000001', password: PASSWORD, accountType: 'encargado' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'aprendiz');
  });

  it('responde el mismo error genérico si la contraseña es incorrecta', async () => {
    const res = await login({ document: '7000000001', password: 'otra-clave' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.message, 'Credenciales inválidas');
  });

  it('responde el mismo error genérico si el documento no existe', async () => {
    const res = await login({ document: '1234567890', password: PASSWORD });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.message, 'Credenciales inválidas');
  });

  it('bloquea la cuenta desactivada con un mensaje claro (403)', async () => {
    const res = await login({ document: '7000000003', password: PASSWORD });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Tu cuenta está desactivada.');
    assert.strictEqual(res.body.estado_cuenta, 'inactivo');
    assert.strictEqual(res.body.token, undefined);
  });

  it('bloquea la cuenta pendiente de aprobación del Coordinador', async () => {
    const res = await login({ document: '7000000004', password: PASSWORD });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Tu cuenta está pendiente de aprobación del Coordinador.');
  });

  it('bloquea la solicitud rechazada y muestra el motivo', async () => {
    const res = await login({ document: '7000000005', password: PASSWORD });
    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /^Tu solicitud fue rechazada\. Motivo: No es instructor del centro/);
  });

  it('con la contraseña incorrecta no revela el estado de la cuenta', async () => {
    const res = await login({ document: '7000000004', password: 'otra-clave' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.message, 'Credenciales inválidas');
  });

  it('responde 400 si falta la contraseña', async () => {
    const res = await login({ document: '7000000001' });
    assert.strictEqual(res.status, 400);
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el usuario de la sesión con es_beneficiario', async () => {
    const { body } = await login({ document: '7000000001', password: PASSWORD });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.document, '7000000001');
    assert.strictEqual(res.body.user.es_beneficiario, true);
  });
});

describe('Token con la cuenta vigente (ADR 014)', () => {
  const tokenDe = async (cedula: string) => (await login({ document: cedula, password: PASSWORD })).body.token as string;
  const me = (token: string) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

  it('una cuenta desactivada deja de entrar aunque su token no haya vencido', async () => {
    const token = await tokenDe('7000000001');
    assert.strictEqual((await me(token)).status, 200);

    await pool.query("UPDATE usuarios SET estado = 'inactivo' WHERE cedula = '7000000001';");
    const res = await me(token);
    await pool.query("UPDATE usuarios SET estado = 'activo' WHERE cedula = '7000000001';");

    assert.strictEqual(res.status, 401);
    assert.match(res.body.message, /desactivada/);
  });

  it('el rol sale de la base de datos y no del token', async () => {
    const token = await tokenDe('7000000002'); // encargado
    await pool.query("UPDATE usuarios SET rol = 'aprendiz' WHERE cedula = '7000000002';");
    const res = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${token}`);
    await pool.query("UPDATE usuarios SET rol = 'encargado' WHERE cedula = '7000000002';");

    assert.strictEqual(res.status, 403);
  });
});

describe('POST /api/auth/facial-login', () => {
  it('ya no existe: el login facial simulado se eliminó', async () => {
    const res = await request(app).post('/api/auth/facial-login').send({ document: '7000000001' });
    assert.strictEqual(res.status, 404);
  });
});
