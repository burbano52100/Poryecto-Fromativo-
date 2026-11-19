import { describe, it, beforeAll, afterEach } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { plantillaRecordatorio } from '../services/recordatorios.service.js';

const app = createApp();

let encargado: UsuarioTest;
let conCorreo: UsuarioTest;
let sinCorreo: UsuarioTest;
let aprendizDeudor: UsuarioTest;

const auth = (u: UsuarioTest) => ({ Authorization: `Bearer ${u.token}` });

const crearDeuda = (usuario: UsuarioTest, monto: number, almuerzos: number, diasAtras: number) =>
  pool.query(
    `INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes, fecha_origen, estado)
     VALUES ($1, $2, $3, (NOW() AT TIME ZONE 'America/Bogota')::date - $4::int, 'pendiente');`,
    [usuario.id, monto, almuerzos, diasAtras]
  );

beforeAll(async () => {
  delete process.env.SMTP_HOST;
  await cleanDatabase();
  encargado = await crearUsuario('Encargado Cartera', '8700000001', 'encargado');
  conCorreo = await crearUsuario('Instructora Con Correo', '8700000002', 'instructor', { email: 'instructora@sena.edu.co' });
  sinCorreo = await crearUsuario('Instructor Sin Correo', '8700000003', 'instructor');
  aprendizDeudor = await crearUsuario('Aprendiz Deudor', '8700000004', 'aprendiz', { email: 'aprendiz@misena.edu.co' });
  await crearDeuda(conCorreo, 25000, 5, 12);
  await crearDeuda(sinCorreo, 10000, 2, 3);
  await crearDeuda(aprendizDeudor, 5000, 1, 1);
});

afterEach(() => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
});

describe('Plantilla del recordatorio', () => {
  it('lleva el nombre, el valor en pesos, los almuerzos y los días', () => {
    const correo = plantillaRecordatorio({
      instructor_id: 'x',
      deuda_id: 'y',
      nombre: 'Ana <b>Ruiz</b>',
      email: 'ana@sena.edu.co',
      monto: 25000,
      almuerzos: 5,
      dias_vencidos: 12,
    });
    assert.match(correo.texto, /Hola, Ana <b>Ruiz<\/b>/);
    assert.match(correo.texto, /\$25\.000/);
    assert.match(correo.texto, /5 almuerzos/);
    assert.match(correo.texto, /12 días/);
    assert.ok(correo.html.includes('Ana &lt;b&gt;Ruiz&lt;/b&gt;'), 'el HTML escapa el nombre');
  });
});

describe('Envío de recordatorios', () => {
  it('sin SMTP se envía en modo prueba y queda en el historial y la auditoría', async () => {
    const res = await request(app).post(`/api/deudas/recordatorios/${conCorreo.id}`).set(auth(encargado));
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.modo_prueba, true);
    assert.match(res.body.message, /modo prueba/);
    const fila = await pool.query('SELECT estado, modo_prueba, destinatario, monto::float8 AS monto FROM recordatorios_deuda;');
    assert.deepStrictEqual(fila.rows[0], { estado: 'enviado', modo_prueba: true, destinatario: 'instructora@sena.edu.co', monto: 25000 });
    const auditoria = await pool.query("SELECT 1 FROM auditoria WHERE entidad = 'recordatorio_deuda' AND accion = 'enviar';");
    assert.strictEqual(auditoria.rowCount, 1);
  });

  it('máximo uno cada 24 horas: el segundo se omite e informa por qué', async () => {
    const res = await request(app).post(`/api/deudas/recordatorios/${conCorreo.id}`).set(auth(encargado));
    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /últimas 24 horas/);

    // Pasadas 24 horas se puede volver a enviar
    await pool.query("UPDATE recordatorios_deuda SET fecha_hora = NOW() - interval '25 hours' WHERE estado = 'enviado';");
    const despues = await request(app).post(`/api/deudas/recordatorios/${conCorreo.id}`).set(auth(encargado));
    assert.strictEqual(despues.status, 200);
  });

  it('el masivo solo va a instructores con deuda y omite a quien no tiene correo o ya recibió uno', async () => {
    const res = await request(app).post('/api/deudas/recordatorios').set(auth(encargado));
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    const porNombre = Object.fromEntries(res.body.resultados.map((r: any) => [r.nombre, r]));
    assert.deepStrictEqual(Object.keys(porNombre).sort(), ['Instructor Sin Correo', 'Instructora Con Correo']);
    assert.strictEqual(porNombre['Instructor Sin Correo'].estado, 'omitido');
    assert.match(porNombre['Instructor Sin Correo'].motivo, /no tiene correo/i);
    assert.strictEqual(porNombre['Instructora Con Correo'].estado, 'omitido');
    assert.strictEqual(res.body.omitidos, 2);
  });

  it('si el SMTP falla queda como fallido con el error', async () => {
    await pool.query('DELETE FROM recordatorios_deuda;').catch(() => undefined);
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = '1';
    const res = await request(app).post(`/api/deudas/recordatorios/${conCorreo.id}`).set(auth(encargado));
    assert.strictEqual(res.status, 502, JSON.stringify(res.body));
    const fila = await pool.query("SELECT estado, error FROM recordatorios_deuda ORDER BY fecha_hora DESC LIMIT 1;");
    assert.strictEqual(fila.rows[0].estado, 'fallido');
    assert.match(fila.rows[0].error, /No se pudo enviar/);
  });

  it('el historial se filtra por instructor y solo lo ve el encargado', async () => {
    const res = await request(app).get(`/api/deudas/recordatorios?instructor_id=${conCorreo.id}`).set(auth(encargado));
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.items.length >= 1);
    assert.ok(res.body.items.every((r: any) => r.instructor_id === conCorreo.id));
    assert.strictEqual(res.body.smtp_configurado, false);
    assert.strictEqual((await request(app).post('/api/deudas/recordatorios').set(auth(conCorreo))).status, 403);
  });
});
