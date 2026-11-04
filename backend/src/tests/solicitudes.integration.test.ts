import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';

// Solicitudes de cuenta de instructor y encargado (ADR 015)
const app = createApp();
const PASSWORD = 'clave-instructor-123';

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;

const registrar = (cedula: string, accountType: 'instructor' | 'encargado', email = `${cedula}@sena.edu.co`) =>
  request(app)
    .post('/api/auth/register')
    .send({ name: `Persona ${cedula}`, document: cedula, email, password: PASSWORD, accountType });

const login = (document: string, password = PASSWORD) => request(app).post('/api/auth/login').send({ document, password });

const api = (method: 'get' | 'post', path: string, token = encargado.token) =>
  request(app)[method](`/api/solicitudes-cuenta${path}`).set('Authorization', `Bearer ${token}`);

const idDeSolicitud = async (cedula: string): Promise<string> =>
  (await pool.query("SELECT id FROM solicitudes_cuenta WHERE cedula = $1 AND estado = 'pendiente'", [cedula])).rows[0].id;

beforeAll(async () => {
  await cleanDatabase();
  encargado = await crearUsuario('Encargado Revisor', '7200000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz Curioso', '7200000002', 'aprendiz');
});

describe('Registro de instructor y encargado', () => {
  it('crea una solicitud pendiente: responde 202, sin token y sin crear el usuario', async () => {
    const res = await registrar('7200000010', 'instructor');
    assert.strictEqual(res.status, 202);
    assert.strictEqual(res.body.token, undefined);
    assert.strictEqual(res.body.solicitud.estado, 'pendiente');
    assert.strictEqual(res.body.solicitud.rol, 'instructor');
    assert.match(res.body.message, /debe aprobar/);

    const usuarios = await pool.query("SELECT 1 FROM usuarios WHERE cedula = '7200000010'");
    assert.strictEqual(usuarios.rows.length, 0);
  });

  it('también acepta solicitudes de encargado', async () => {
    const res = await registrar('7200000011', 'encargado');
    assert.strictEqual(res.status, 202);
    assert.strictEqual(res.body.solicitud.rol, 'encargado');
  });

  it('no permite dos solicitudes pendientes con el mismo documento o correo', async () => {
    assert.strictEqual((await registrar('7200000010', 'instructor', 'otro@sena.edu.co')).status, 409);
    const mismoCorreo = await registrar('7200000099', 'instructor', '7200000010@SENA.edu.co');
    assert.strictEqual(mismoCorreo.status, 409);
    assert.match(mismoCorreo.body.message, /correo/);
  });

  it('no permite solicitar con un documento que ya es usuario', async () => {
    const res = await registrar(aprendiz.cedula, 'instructor');
    assert.strictEqual(res.status, 409);
  });
});

describe('Login de una solicitud sin aprobar', () => {
  it('con la contraseña correcta avisa que está pendiente (403)', async () => {
    const res = await login('7200000010');
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.estado_solicitud, 'pendiente');
    assert.match(res.body.message, /pendiente/);
  });

  it('con la contraseña incorrecta responde el error genérico (401)', async () => {
    const res = await login('7200000010', 'otra-clave-123');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.message, 'Credenciales inválidas');
  });
});

describe('Revisión por el encargado', () => {
  it('solo el encargado puede ver y revisar solicitudes', async () => {
    assert.strictEqual((await request(app).get('/api/solicitudes-cuenta')).status, 401);
    assert.strictEqual((await api('get', '', aprendiz.token)).status, 403);
    const id = await idDeSolicitud('7200000010');
    assert.strictEqual((await api('post', `/${id}/aprobar`, aprendiz.token)).status, 403);
  });

  it('lista las pendientes en orden de llegada, sin exponer la contraseña', async () => {
    const res = await api('get', '');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(
      res.body.map((s: { documento: string }) => s.documento),
      ['7200000010', '7200000011']
    );
    assert.strictEqual(res.body[0].password_hash, undefined);
  });

  it('el resumen del encargado cuenta las solicitudes pendientes', async () => {
    const res = await request(app).get('/api/dashboard/encargado').set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(res.body.solicitudesPendientes, 2);
  });

  it('al aprobar se crea el usuario con su rol y ya puede iniciar sesión', async () => {
    const id = await idDeSolicitud('7200000010');
    const res = await api('post', `/${id}/aprobar`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.usuario.role, 'instructor');

    const ingreso = await login('7200000010');
    assert.strictEqual(ingreso.status, 200);
    assert.strictEqual(ingreso.body.user.role, 'instructor');

    const sol = await pool.query('SELECT estado, revisado_por, usuario_id FROM solicitudes_cuenta WHERE id = $1', [id]);
    assert.strictEqual(sol.rows[0].estado, 'aprobada');
    assert.strictEqual(sol.rows[0].revisado_por, encargado.id);
    assert.strictEqual(sol.rows[0].usuario_id, res.body.usuario.id);

    // Una solicitud ya revisada no se puede volver a aprobar ni rechazar
    assert.strictEqual((await api('post', `/${id}/aprobar`)).status, 409);
    assert.strictEqual((await api('post', `/${id}/rechazar`)).status, 409);
  });

  it('al rechazar con motivo, el login lo informa y la persona puede volver a solicitar', async () => {
    const id = await idDeSolicitud('7200000011');
    const res = await api('post', `/${id}/rechazar`).send({ motivo: 'No pertenece al comedor' });
    assert.strictEqual(res.status, 200);

    const ingreso = await login('7200000011');
    assert.strictEqual(ingreso.status, 403);
    assert.strictEqual(ingreso.body.estado_solicitud, 'rechazada');
    assert.match(ingreso.body.message, /No pertenece al comedor/);

    assert.strictEqual((await registrar('7200000011', 'encargado')).status, 202);
  });

  it('no aprueba si mientras tanto se creó un usuario con ese documento', async () => {
    await registrar('7200000012', 'instructor');
    const id = await idDeSolicitud('7200000012');
    await crearUsuario('Usuario Repetido', '7200000012', 'aprendiz');

    const res = await api('post', `/${id}/aprobar`);
    assert.strictEqual(res.status, 409);
    const sol = await pool.query('SELECT estado FROM solicitudes_cuenta WHERE id = $1', [id]);
    assert.strictEqual(sol.rows[0].estado, 'pendiente');
  });

  it('el historial muestra quién revisó cada solicitud', async () => {
    const res = await api('get', '?estado=todas');
    const aprobada = res.body.find((s: { estado: string }) => s.estado === 'aprobada');
    assert.strictEqual(aprobada.revisado_por, 'Encargado Revisor');
    assert.ok(res.body.some((s: { estado: string; motivo_rechazo: string }) => s.estado === 'rechazada' && s.motivo_rechazo));
  });

  it('valida el identificador y el filtro', async () => {
    assert.strictEqual((await api('post', '/no-es-uuid/aprobar')).status, 400);
    assert.strictEqual((await api('post', '/00000000-0000-0000-0000-000000000000/aprobar')).status, 404);
    assert.strictEqual((await api('post', '/00000000-0000-0000-0000-000000000000/rechazar')).status, 404);
    assert.strictEqual((await api('get', '?estado=inventado')).status, 400);
  });
});
