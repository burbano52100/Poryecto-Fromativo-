import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearFicha, crearUsuario, type UsuarioTest } from './helpers/auth.js';

const app = createApp();
const PASSWORD = 'clave-segura-123';

let coordinador: UsuarioTest;
let encargado: UsuarioTest;

const coord = (method: 'get' | 'post' | 'patch', path: string, token = coordinador.token) =>
  request(app)[method](`/api/coordinador${path}`).set('Authorization', `Bearer ${token}`);

const registrar = (datos: Record<string, string>) =>
  request(app)
    .post('/api/auth/register')
    .send({ password: PASSWORD, email: `${datos.document}@misena.edu.co`, ...datos });

const login = (document: string, password = PASSWORD) => request(app).post('/api/auth/login').send({ document, password });

beforeAll(async () => {
  await cleanDatabase();
  coordinador = await crearUsuario('Coordinadora Académica', '9300000001', 'coordinador');
  encargado = await crearUsuario('Encargado Comedor', '9300000002', 'encargado');
});

describe('Registro y aprobación de instructores y aprendices', () => {
  it('el instructor que se registra queda pendiente y no puede iniciar sesión', async () => {
    const res = await registrar({ name: 'Instructor Nuevo', document: '9300000010', accountType: 'instructor' });
    assert.strictEqual(res.status, 202, JSON.stringify(res.body));
    assert.strictEqual(res.body.solicitud.estado, 'pendiente');
    assert.strictEqual(res.body.token, undefined);

    const intento = await login('9300000010');
    assert.strictEqual(intento.status, 403);
    assert.strictEqual(intento.body.message, 'Tu cuenta está pendiente de aprobación del Coordinador.');
  });

  it('el aprendiz que no está en una lista del coordinador también queda pendiente', async () => {
    const res = await registrar({ name: 'Aprendiz Sin Lista', document: '9300000011', accountType: 'aprendiz', ficha: '3000111' });
    assert.strictEqual(res.status, 202);
    assert.strictEqual((await login('9300000011')).status, 403);
  });

  it('ya no permite registrar encargados ni coordinadores', async () => {
    for (const accountType of ['encargado', 'coordinador']) {
      const res = await registrar({ name: 'Otra Persona', document: '9300000012', accountType });
      assert.strictEqual(res.status, 400);
    }
  });

  it('el aprendiz cuya cédula cargó el coordinador queda activo al registrarse y entra de una vez', async () => {
    const fichaId = await crearFicha('3000222');
    await pool.query(
      `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, ficha_id, estado, origen, debe_cambiar_clave)
       VALUES ('Aprendiz En Lista', '9300000013', '9300000013@misena.edu.co', 'x', 'aprendiz', $1, 'activo', 'carga_masiva', true);`,
      [fichaId]
    );
    const otroCorreo = await registrar({
      name: 'Aprendiz En Lista',
      document: '9300000013',
      accountType: 'aprendiz',
      ficha: '3000222',
      email: 'otro@correo.com',
    });
    assert.strictEqual(otroCorreo.status, 409, 'con otro correo no activa la cuenta');

    const res = await registrar({ name: 'Aprendiz En Lista', document: '9300000013', accountType: 'aprendiz', ficha: '3000222' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.debe_cambiar_clave, false);
    assert.strictEqual((await login('9300000013')).status, 200);
  });

  it('la bandeja muestra las solicitudes pendientes con búsqueda', async () => {
    const res = await coord('get', '/solicitudes');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(
      res.body.map((s: any) => s.cedula).sort(),
      ['9300000010', '9300000011']
    );
    const filtrada = await coord('get', '/solicitudes?q=Instructor');
    assert.deepStrictEqual(filtrada.body.map((s: any) => s.cedula), ['9300000010']);
  });

  it('aprueba varias a la vez, queda en la auditoría y ya pueden entrar', async () => {
    const pendientes = (await coord('get', '/solicitudes')).body.map((s: any) => s.id);
    const res = await coord('post', '/solicitudes/aprobar').send({ ids: pendientes });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.aprobadas, 2);
    assert.strictEqual((await login('9300000010')).status, 200);

    const auditoria = await pool.query("SELECT COUNT(*)::int AS n FROM auditoria WHERE accion = 'aprobar' AND usuario_id = $1;", [
      coordinador.id,
    ]);
    assert.strictEqual(auditoria.rows[0].n, 2);
  });

  it('rechazar exige un motivo, y el login muestra el motivo', async () => {
    await registrar({ name: 'Instructor Rechazable', document: '9300000014', accountType: 'instructor' });
    const id = (await coord('get', '/solicitudes')).body[0].id;
    const sinMotivo = await coord('post', '/solicitudes/rechazar').send({ ids: [id] });
    assert.strictEqual(sinMotivo.status, 400);

    const res = await coord('post', '/solicitudes/rechazar').send({ ids: [id], motivo: 'No pertenece al centro' });
    assert.strictEqual(res.status, 200);
    const intento = await login('9300000014');
    assert.strictEqual(intento.status, 403);
    assert.match(intento.body.message, /Tu solicitud fue rechazada\. Motivo: No pertenece al centro/);
  });
});

describe('Gestión de usuarios', () => {
  it('filtra por rol, estado y búsqueda', async () => {
    const res = await coord('get', '/usuarios?rol=instructor&estado=activo');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.items.every((u: any) => u.rol === 'instructor' && u.estado === 'activo'));
    const busqueda = await coord('get', '/usuarios?q=9300000013');
    assert.deepStrictEqual(busqueda.body.items.map((u: any) => u.nombre), ['Aprendiz En Lista']);
  });

  it('desactivar a un aprendiz beneficiario finaliza su beneficio y avisa al encargado', async () => {
    const aprendiz = (await pool.query("SELECT id FROM usuarios WHERE cedula = '9300000013';")).rows[0].id;
    await pool.query(
      `INSERT INTO beneficios (usuario_id, estado, fecha_inicio, prioridad, sin_apoyo_incompatible)
       VALUES ($1, 'activo', (NOW() AT TIME ZONE 'America/Bogota')::date, 1, true);`,
      [aprendiz]
    );
    const res = await coord('patch', `/usuarios/${aprendiz}/estado`).send({ estado: 'inactivo' });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.match(res.body.message, /se avisó al Encargado/);

    const beneficio = await pool.query('SELECT estado, motivo_fin FROM beneficios WHERE usuario_id = $1;', [aprendiz]);
    assert.deepStrictEqual(beneficio.rows[0], { estado: 'finalizado', motivo_fin: 'cuenta_desactivada' });
    const alerta = await pool.query("SELECT 1 FROM alertas WHERE tipo = 'beneficiario_inactivo';");
    assert.strictEqual(alerta.rowCount, 1);
    assert.strictEqual((await login('9300000013')).body.message, 'Tu cuenta está desactivada.');

    assert.strictEqual((await coord('patch', `/usuarios/${aprendiz}/estado`).send({ estado: 'activo' })).status, 200);
  });

  it('restablecer la contraseña la deja en la cédula con cambio obligatorio', async () => {
    const instructor = (await pool.query("SELECT id FROM usuarios WHERE cedula = '9300000010';")).rows[0].id;
    assert.strictEqual((await coord('post', `/usuarios/${instructor}/restablecer-clave`)).status, 200);

    const sesion = await login('9300000010', '9300000010');
    assert.strictEqual(sesion.status, 200);
    assert.strictEqual(sesion.body.user.debe_cambiar_clave, true);
    const token = sesion.body.token;

    // Mientras no cambie la clave, el resto de la API responde 403
    const bloqueada = await request(app).get('/api/consumos').set('Authorization', `Bearer ${token}`);
    assert.strictEqual(bloqueada.status, 403);
    assert.strictEqual(bloqueada.body.debe_cambiar_clave, true);

    const igualCedula = await request(app)
      .post('/api/auth/cambiar-clave')
      .set('Authorization', `Bearer ${token}`)
      .send({ actual: '9300000010', nueva: '9300000010' });
    assert.strictEqual(igualCedula.status, 400);

    const cambio = await request(app)
      .post('/api/auth/cambiar-clave')
      .set('Authorization', `Bearer ${token}`)
      .send({ actual: '9300000010', nueva: 'nueva-clave-segura' });
    assert.strictEqual(cambio.status, 200);
    assert.strictEqual((await request(app).get('/api/consumos').set('Authorization', `Bearer ${token}`)).status, 200);
  });
});

describe('Permisos del coordinador', () => {
  it('el encargado ya no gestiona cuentas: 403 en todo el módulo', async () => {
    assert.strictEqual((await coord('get', '/solicitudes', encargado.token)).status, 403);
    assert.strictEqual((await coord('get', '/usuarios', encargado.token)).status, 403);
  });

  it('el coordinador no accede a ventas, inventario, deudas ni cierres de caja', async () => {
    for (const ruta of ['/api/ventas', '/api/inventario/materiales', '/api/deudas', '/api/cierres-caja/resumen', '/api/reportes/ventas']) {
      const res = await request(app).get(ruta).set('Authorization', `Bearer ${coordinador.token}`);
      assert.strictEqual(res.status, 403, ruta);
    }
  });

  it('el resumen del panel cuenta activos, pendientes, instructores y aprendices', async () => {
    const res = await coord('get', '/resumen');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(Object.keys(res.body).sort(), ['activos', 'aprendices', 'instructores', 'pendientes']);
  });
});
