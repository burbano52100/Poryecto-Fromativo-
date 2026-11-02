import { describe, it, beforeAll, beforeEach } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, crearMenu, type UsuarioTest } from './helpers/auth.js';

const app = createApp();
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

let encargado: UsuarioTest;
let aprendiz: UsuarioTest;
let beneficiario: UsuarioTest;
let contadorMenus = 0;

/** Inicio de cada período en hora de Colombia, calculado aparte del SQL del controlador. */
const inicioPeriodo = (periodo: string): Date => {
  const hoy = new Date(Date.now() - OFFSET_BOGOTA_MS);
  const y = hoy.getUTCFullYear();
  const m = hoy.getUTCMonth();
  const d = hoy.getUTCDate();
  const medianoche = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd) + OFFSET_BOGOTA_MS);
  switch (periodo) {
    case 'dia': return medianoche(y, m, d);
    case 'semana': return medianoche(y, m, d - ((hoy.getUTCDay() + 6) % 7));
    case 'mes': return medianoche(y, m, 1);
    case 'trimestre': return medianoche(y, m - (m % 3), 1);
    case 'semestre': return medianoche(y, m < 6 ? 0 : 6, 1);
    default: return medianoche(y, 0, 1);
  }
};

const insertarVenta = async (
  usuario: UsuarioTest,
  fecha: Date,
  precio: number,
  estadoPago: 'pagado' | 'pendiente' | 'gratis'
) => {
  contadorMenus += 1;
  const menuId = await crearMenu(`Menú ${contadorMenus}`, { estado: 'completado' });
  await pool.query(
    `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago)
     VALUES ($1, $2, $3, $4, 'efectivo', $5);`,
    [usuario.id, menuId, fecha, precio, estadoPago]
  );
};

const reporte = (period?: string, token = encargado.token) =>
  request(app)
    .get('/api/ventas')
    .query(period === undefined ? {} : { period })
    .set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  await cleanDatabase();
  encargado = await crearUsuario('Encargado', '8200000001', 'encargado');
  aprendiz = await crearUsuario('Aprendiz Normal', '8200000002', 'aprendiz');
  beneficiario = await crearUsuario('Aprendiz Beneficiario', '8200000003', 'aprendiz', { esBeneficiario: true });
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE ventas, menus_dia RESTART IDENTITY CASCADE;');
});

describe('GET /api/ventas', () => {
  it('separa almuerzos servidos, ingresos cobrados, por cobrar y gratis', async () => {
    const ahora = new Date();
    await insertarVenta(aprendiz, ahora, 5000, 'pagado');
    await insertarVenta(aprendiz, ahora, 5000, 'pendiente');
    await insertarVenta(beneficiario, ahora, 0, 'gratis');

    const res = await reporte('Día');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.totales, {
      almuerzosServidos: 3,
      almuerzosGratis: 1,
      ingresosCobrados: 5000,
      porCobrar: 5000,
    });
    assert.strictEqual(res.body.transacciones.length, 3);
    const gratis = res.body.transacciones.find((t: any) => t.estado_pago === 'gratis');
    assert.strictEqual(gratis.beneficiario, true);
    assert.strictEqual(gratis.precio, 0);
  });

  for (const periodo of ['dia', 'semana', 'mes', 'trimestre', 'semestre', 'ano']) {
    it(`período ${periodo}: incluye una venta al inicio y excluye la del minuto anterior`, async () => {
      const inicio = inicioPeriodo(periodo);
      await insertarVenta(aprendiz, inicio, 5000, 'pagado');
      await insertarVenta(aprendiz, new Date(inicio.getTime() - 60_000), 5000, 'pagado');

      const res = await reporte(periodo);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.period, periodo);
      assert.strictEqual(res.body.totales.almuerzosServidos, 1);
      assert.strictEqual(res.body.totales.ingresosCobrados, 5000);
      assert.strictEqual(res.body.transacciones.length, 1);
      assert.strictEqual(res.body.breakdown.reduce((n: number, b: any) => n + b.count, 0), 1);
    });
  }

  it('agrupa por día hasta el trimestre y por mes en semestre y año, sin recortar el gráfico', async () => {
    await insertarVenta(aprendiz, new Date(), 5000, 'pagado');

    const mes = await reporte('Mes');
    const diaDelMes = new Date(Date.now() - OFFSET_BOGOTA_MS).getUTCDate();
    assert.strictEqual(mes.body.agrupacion, 'dia');
    assert.strictEqual(mes.body.breakdown.length, diaDelMes);

    const ano = await reporte('Año');
    const mesActual = new Date(Date.now() - OFFSET_BOGOTA_MS).getUTCMonth();
    assert.strictEqual(ano.body.agrupacion, 'mes');
    assert.strictEqual(ano.body.breakdown.length, mesActual + 1);
    assert.strictEqual(ano.body.breakdown.at(-1).count, 1);
    assert.strictEqual(ano.body.breakdown.at(-1).percent, 100);
  });

  it('usa Semana si no se envía período', async () => {
    const res = await reporte();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.period, 'semana');
  });

  it('responde 400 a un período desconocido', async () => {
    const res = await reporte('Quincena');
    assert.strictEqual(res.status, 400);
  });

  it('solo lo puede consultar el encargado', async () => {
    const res = await reporte('Día', aprendiz.token);
    assert.strictEqual(res.status, 403);
  });
});
