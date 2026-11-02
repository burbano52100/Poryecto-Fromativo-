import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, crearFicha, type UsuarioTest } from './helpers/auth.js';

const app = createApp();

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;
let instructor: UsuarioTest;
let invitado: UsuarioTest;

const enviar = (usuario: UsuarioTest, asunto: string) =>
  request(app)
    .post('/api/sugerencias')
    .set('Authorization', `Bearer ${usuario.token}`)
    .send({ asunto, mensaje: `Mensaje de prueba enviado por ${usuario.nombre}.` });

const listar = (usuario: UsuarioTest) =>
  request(app).get('/api/sugerencias').set('Authorization', `Bearer ${usuario.token}`);

const resumen = () =>
  request(app).get('/api/dashboard/encargado').set('Authorization', `Bearer ${encargado.token}`);

beforeAll(async () => {
  await cleanDatabase();
  const fichaId = await crearFicha('2847251');
  encargado = await crearUsuario('Encargado', '8500000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz', '8500000002', 'aprendiz', { fichaId });
  instructor = await crearUsuario('Instructor', '8500000003', 'instructor');
  invitado = await crearUsuario('Invitado', '8500000004', 'invitado');
});

describe('Buzón de sugerencias entre roles', () => {
  it('las sugerencias de los tres roles llegan al buzón del encargado', async () => {
    assert.strictEqual((await enviar(aprendiz, 'Sopa fría')).status, 201);
    assert.strictEqual((await enviar(instructor, 'Más opciones')).status, 201);
    assert.strictEqual((await enviar(invitado, 'Excelente atención')).status, 201);

    const res = await listar(encargado);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 3);
    const delAprendiz = res.body.find((s: any) => s.subject === 'Sopa fría');
    assert.strictEqual(delAprendiz.role, 'Aprendiz');
    assert.strictEqual(delAprendiz.fichaOrDoc, 'Ficha 2847251');
    assert.strictEqual(delAprendiz.status, 'PENDIENTE');

    assert.strictEqual((await resumen()).body.sugerenciasPendientes, 3);
  });

  it('cada usuario ve solo sus propias sugerencias', async () => {
    const res = await listar(aprendiz);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].subject, 'Sopa fría');
  });

  it('al responder, la sugerencia queda atendida y bajan las pendientes', async () => {
    const { body } = await listar(encargado);
    const id = body.find((s: any) => s.subject === 'Sopa fría').id;

    const res = await request(app)
      .patch(`/api/sugerencias/${id}/responder`)
      .set('Authorization', `Bearer ${encargado.token}`)
      .send({ respuesta: 'Gracias, ya revisamos la temperatura.' });
    assert.strictEqual(res.status, 200);

    const delAprendiz = await listar(aprendiz);
    assert.strictEqual(delAprendiz.body[0].status, 'ATENDIDA');
    assert.strictEqual(delAprendiz.body[0].respuesta, 'Gracias, ya revisamos la temperatura.');
    assert.strictEqual((await resumen()).body.sugerenciasPendientes, 2);
  });

  it('valida el contenido y solo deja responder al encargado', async () => {
    const corta = await request(app)
      .post('/api/sugerencias')
      .set('Authorization', `Bearer ${aprendiz.token}`)
      .send({ asunto: 'ab', mensaje: 'corto' });
    assert.strictEqual(corta.status, 400);

    const { body } = await listar(encargado);
    const responderComoAprendiz = await request(app)
      .patch(`/api/sugerencias/${body[0].id}/responder`)
      .set('Authorization', `Bearer ${aprendiz.token}`)
      .send({ respuesta: 'Hola' });
    assert.strictEqual(responderComoAprendiz.status, 403);

    const idInvalido = await request(app)
      .patch('/api/sugerencias/123/responder')
      .set('Authorization', `Bearer ${encargado.token}`)
      .send({});
    assert.strictEqual(idInvalido.status, 400);
  });
});

describe('GET /api/dashboard/encargado', () => {
  it('resume ventas, ingresos y deudas de hoy', async () => {
    const menu = await pool.query(
      `INSERT INTO menus_dia (fecha, nombre, precio_aprendiz, precio_invitado, cantidad_disponible, estado)
       VALUES ((NOW() AT TIME ZONE 'America/Bogota')::date, 'Menú', 5000, 8000, 50, 'activo') RETURNING id;`
    );
    await pool.query(
      `INSERT INTO ventas (usuario_id, menu_id, precio_cobrado, metodo_pago, estado_pago)
       VALUES ($1, $3, 5000, 'efectivo', 'pagado'), ($2, $3, 5000, 'credito', 'pendiente');`,
      [aprendiz.id, instructor.id, menu.rows[0].id]
    );
    await pool.query("INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes) VALUES ($1, 5000, 1);", [
      instructor.id,
    ]);

    const res = await resumen();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ventasHoy, 2);
    assert.strictEqual(res.body.ingresosHoy, 5000);
    assert.strictEqual(res.body.porCobrarHoy, 5000);
    assert.deepStrictEqual(res.body.deudasPendientes, { monto: 5000, cantidad: 1 });
  });

  it('solo lo puede consultar el encargado', async () => {
    const res = await request(app).get('/api/dashboard/encargado').set('Authorization', `Bearer ${aprendiz.token}`);
    assert.strictEqual(res.status, 403);
  });
});
