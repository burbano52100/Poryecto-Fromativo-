import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, crearFicha, crearMenu, type UsuarioTest } from './helpers/auth.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';
import { fechaRelativa } from './helpers/fechas.js';

const app = createApp();

let encargado: UsuarioTest;
let coordinador: UsuarioTest;
let aprendiz: UsuarioTest;
let otroAprendiz: UsuarioTest;
let instructor: UsuarioTest;
let fichaId: string;

const auth = (u: UsuarioTest) => ({ Authorization: `Bearer ${u.token}` });
const HOY = () => fechaRelativa(0);

beforeAll(async () => {
  fijarHoraBogota(12);
  await cleanDatabase();
  fichaId = await crearFicha('2950001');
  encargado = await crearUsuario('Encargada Caja', '8300000001', 'encargado');
  coordinador = await crearUsuario('Coordinador', '8300000002', 'coordinador');
  aprendiz = await crearUsuario('Aprendiz Caja', '8300000003', 'aprendiz', { fichaId });
  otroAprendiz = await crearUsuario('Otro Aprendiz', '8300000005', 'aprendiz', { fichaId });
  instructor = await crearUsuario('Instructor Caja', '8300000004', 'instructor');
  await crearMenu('Menú caja', { disponible: 100 });
});

afterAll(() => restaurarReloj());

describe('Cierre de caja diario', () => {
  let invitadoId: string;
  let ventaAprendiz: string;

  it('el resumen del día cuenta almuerzos por tipo y deja el pago con QR fuera de la caja', async () => {
    ventaAprendiz = (await request(app).post('/api/consumos/reservar').set(auth(aprendiz)).send({})).body.id;
    assert.ok(ventaAprendiz);
    assert.strictEqual((await request(app).post('/api/consumos/reservar').set(auth(instructor)).send({})).status, 201);
    const invitado = await request(app).post('/api/almuerzos-invitados').set(auth(encargado)).send({ tipo: 'corriente', cantidad: 2 });
    invitadoId = invitado.body.id;

    const res = await request(app).get('/api/cierres-caja/resumen').set(auth(encargado));
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.almuerzos.aprendices, 1);
    assert.strictEqual(res.body.almuerzos.instructores, 1);
    assert.strictEqual(res.body.almuerzos.invitados_corrientes, 2);
    // Las dos reservas se pagan con el código QR (ADR 027): ese dinero va a la cuenta, no a la caja
    assert.strictEqual(res.body.ingresos.qr_pendientes, 10000);
    assert.strictEqual(res.body.ingresos.qr_pagados, 0);
    assert.strictEqual(res.body.ingresos_esperados, 22000);
    assert.strictEqual(res.body.cierre, null);
  });

  it('cerrar el día calcula la diferencia y queda en la auditoría', async () => {
    const res = await request(app)
      .post('/api/cierres-caja')
      .set(auth(encargado))
      .send({ ingresos_recibidos: 20000, observaciones: 'Faltó cobrar un invitado' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.cierre.diferencia, -2000);
    assert.match(res.body.message, /faltante de \$2\.000/);
    const auditoria = await pool.query("SELECT 1 FROM auditoria WHERE entidad = 'cierre_caja' AND accion = 'cerrar';");
    assert.strictEqual(auditoria.rowCount, 1);

    const otraVez = await request(app).post('/api/cierres-caja').set(auth(encargado)).send({ ingresos_recibidos: 1 });
    assert.strictEqual(otraVez.status, 409);
  });

  it('con el día cerrado no se pueden crear ni cambiar reservas, invitados ni pagos de esa fecha', async () => {
    const reserva = await request(app).post('/api/consumos/reservar').set(auth(otroAprendiz)).send({});
    assert.strictEqual(reserva.status, 409);
    assert.match(reserva.body.message, /está cerrada/);

    const cancelar = await request(app).post(`/api/consumos/${ventaAprendiz}/cancelar`).set(auth(aprendiz));
    assert.strictEqual(cancelar.status, 409);

    const crear = await request(app).post('/api/almuerzos-invitados').set(auth(encargado)).send({ tipo: 'aprendiz', cantidad: 1 });
    assert.strictEqual(crear.status, 409);
    const lista = await request(app).get('/api/almuerzos-invitados').set(auth(encargado));
    assert.strictEqual(lista.body[0].dia_cerrado, true);
    const editar = await request(app)
      .put(`/api/almuerzos-invitados/${invitadoId}`)
      .set(auth(encargado))
      .send({ cantidad: 3, fecha_hora: `${HOY()}T08:00` });
    assert.strictEqual(editar.status, 409);
    assert.strictEqual((await request(app).delete(`/api/almuerzos-invitados/${invitadoId}`).set(auth(encargado))).status, 409);

    const pago = await request(app).patch(`/api/grupos/ventas/${ventaAprendiz}/pago`).set(auth(encargado)).send({ pagado: true });
    assert.strictEqual(pago.status, 409);
    // Deuda fiada de antes del pago con QR (ADR 026)
    const deuda = (
      await pool.query(
        `INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes, fecha_origen, estado)
         VALUES ($1, 5000, 1, (NOW() AT TIME ZONE 'America/Bogota')::date - 3, 'pendiente') RETURNING id;`,
        [instructor.id]
      )
    ).rows[0].id;
    assert.strictEqual((await request(app).post(`/api/deudas/${deuda}/pagar`).set(auth(encargado)).send({})).status, 409);
  });

  it('reabrir exige motivo, queda auditado y permite corregir y volver a cerrar', async () => {
    const sinMotivo = await request(app).post(`/api/cierres-caja/${HOY()}/reabrir`).set(auth(encargado)).send({});
    assert.strictEqual(sinMotivo.status, 400);
    const reabrir = await request(app)
      .post(`/api/cierres-caja/${HOY()}/reabrir`)
      .set(auth(encargado))
      .send({ motivo: 'Corregir el pago de un aprendiz' });
    assert.strictEqual(reabrir.status, 200, JSON.stringify(reabrir.body));
    assert.strictEqual(reabrir.body.cierre.estado, 'reabierto');

    assert.strictEqual(
      (await request(app).patch(`/api/grupos/ventas/${ventaAprendiz}/pago`).set(auth(encargado)).send({ pagado: true })).status,
      200
    );
    const resumen = await request(app).get('/api/cierres-caja/resumen').set(auth(encargado));
    assert.strictEqual(resumen.body.ingresos.qr_pagados, 5000, 'el pago confirmado a mano sigue siendo por QR');
    const cerrar = await request(app).post('/api/cierres-caja').set(auth(encargado)).send({ ingresos_recibidos: 22000 });
    assert.strictEqual(cerrar.status, 201);
    assert.strictEqual(cerrar.body.cierre.diferencia, 0);
    const auditoria = await pool.query("SELECT accion FROM auditoria WHERE entidad = 'cierre_caja' ORDER BY fecha_hora;");
    assert.deepStrictEqual(auditoria.rows.map((r) => r.accion), ['cerrar', 'reabrir', 'cerrar']);
  });

  it('el historial filtra por fechas, no se cierran días futuros y el coordinador no tiene acceso', async () => {
    const historial = await request(app).get(`/api/cierres-caja?desde=${fechaRelativa(-7)}&hasta=${HOY()}`).set(auth(encargado));
    assert.strictEqual(historial.status, 200);
    assert.strictEqual(historial.body.items.length, 1);
    const vacio = await request(app).get(`/api/cierres-caja?desde=${fechaRelativa(-7)}&hasta=${fechaRelativa(-1)}`).set(auth(encargado));
    assert.strictEqual(vacio.body.items.length, 0);

    const futuro = await request(app).post('/api/cierres-caja').set(auth(encargado)).send({ fecha: fechaRelativa(1), ingresos_recibidos: 0 });
    assert.strictEqual(futuro.status, 400);
    assert.strictEqual((await request(app).get('/api/cierres-caja/resumen').set(auth(coordinador))).status, 403);
  });
});
