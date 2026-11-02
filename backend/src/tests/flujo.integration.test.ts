/**
 * Flujo completo entre roles, solo a través de la API:
 * registro → menú → beneficio → reservas → Ventas y Grupos del Encargado → pago → Consumos del aprendiz.
 */
import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';

const app = createApp();
const PASSWORD = 'clave-segura-123';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const registrar = async (name: string, document: string) => {
  const res = await request(app).post('/api/auth/register').send({
    name,
    document,
    accountType: 'aprendiz',
    ficha: '2847251',
    email: `${document}@misena.edu.co`,
    password: PASSWORD,
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  return res.body as { token: string; user: { id: string } };
};

beforeAll(async () => {
  fijarHoraBogota(11);
  await cleanDatabase();
  const hash = await bcrypt.hash(PASSWORD, 10);
  await pool.query(
    "INSERT INTO usuarios (nombre, cedula, password_hash, rol) VALUES ('Encargado Flujo', '8700000001', $1, 'encargado');",
    [hash]
  );
});

afterAll(() => {
  restaurarReloj();
});

describe('Flujo completo Aprendiz → Encargado → Aprendiz', () => {
  it('reserva, se refleja en Ventas y Grupos, se marca pagada y el aprendiz lo ve', async () => {
    // 1. El encargado inicia sesión solo con documento y contraseña
    const loginEncargado = await request(app)
      .post('/api/auth/login')
      .send({ document: '8700000001', password: PASSWORD });
    assert.strictEqual(loginEncargado.body.user.role, 'encargado');
    const encargado = loginEncargado.body.token as string;

    // 2. Dos aprendices crean su cuenta en la misma ficha
    const carlos = await registrar('Carlos Normal', '8700000002');
    const ana = await registrar('Ana Beneficiaria', '8700000003');

    // 3. El encargado publica el menú de hoy y vuelve beneficiaria a Ana
    const hoy = (await pool.query("SELECT TO_CHAR((NOW() AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS d;")).rows[0].d;
    const menu = await request(app).post('/api/menus').set(auth(encargado)).send({
      nombre: 'Bandeja Huilense',
      fecha: hoy,
      precio_aprendiz: 5000,
      precio_invitado: 8000,
      cantidad_disponible: 100,
      estado: 'activo',
    });
    assert.strictEqual(menu.status, 201, JSON.stringify(menu.body));

    const estudiantes = await request(app).get('/api/beneficiarios/estudiantes').set(auth(encargado));
    assert.strictEqual(estudiantes.body.length, 2);
    const beneficio = await request(app)
      .patch(`/api/beneficiarios/${ana.user.id}`)
      .set(auth(encargado))
      .send({ es_beneficiario: true });
    assert.strictEqual(beneficio.status, 200);

    // 4. Ana ve $0 y reserva con un clic (sin menu_id); Carlos reserva a $5.000
    const menuAna = await request(app).get('/api/menus/activo').set(auth(ana.token));
    assert.strictEqual(menuAna.body.precio_aplicable, 0);
    assert.strictEqual(menuAna.body.reservable, true);
    const reservaAna = await request(app).post('/api/consumos/reservar').set(auth(ana.token)).send({});
    assert.strictEqual(reservaAna.status, 201);
    assert.strictEqual(reservaAna.body.precio, 0);

    const reservaCarlos = await request(app)
      .post('/api/consumos/reservar')
      .set(auth(carlos.token))
      .send({ menu_id: menu.body.id });
    assert.strictEqual(reservaCarlos.status, 201);
    assert.strictEqual(reservaCarlos.body.precio, 5000);

    // 5. El encargado lo ve en Ventas (Día) y en el encabezado del panel
    const ventas = await request(app).get('/api/ventas?period=Día').set(auth(encargado));
    assert.deepStrictEqual(ventas.body.totales, {
      almuerzosServidos: 2,
      almuerzosGratis: 1,
      ingresosCobrados: 0,
      porCobrar: 5000,
    });
    const resumen = await request(app).get('/api/dashboard/encargado').set(auth(encargado));
    assert.strictEqual(resumen.body.ventasHoy, 2);

    // 6. En Grupos la ficha muestra las dos reservas; marca pagado a Carlos
    const grupos = await request(app).get('/api/grupos').set(auth(encargado));
    const ficha = grupos.body.find((g: any) => g.ficha === '2847251');
    assert.strictEqual(ficha.reservasHoy, 2);

    const aprendices = await request(app).get(`/api/grupos/${ficha.id}/aprendices`).set(auth(encargado));
    const filaCarlos = aprendices.body.aprendices.find((a: any) => a.name === 'Carlos Normal');
    const pago = await request(app)
      .patch(`/api/grupos/ventas/${filaCarlos.venta_id}/pago`)
      .set(auth(encargado))
      .send({ pagado: true });
    assert.strictEqual(pago.status, 200);

    // 7. Carlos ve su almuerzo de hoy reservado y pagado; los ingresos ya cuentan
    const consumosCarlos = await request(app).get('/api/consumos').set(auth(carlos.token));
    assert.strictEqual(consumosCarlos.body[0].status, 'RESERVED');
    assert.strictEqual(consumosCarlos.body[0].paymentStatus, 'PAGADO');

    const consumosAna = await request(app).get('/api/consumos').set(auth(ana.token));
    assert.strictEqual(consumosAna.body[0].paymentStatus, 'GRATIS');

    const ventasDespues = await request(app).get('/api/ventas?period=Día').set(auth(encargado));
    assert.strictEqual(ventasDespues.body.totales.ingresosCobrados, 5000);
    assert.strictEqual(ventasDespues.body.totales.porCobrar, 0);
  });
});
