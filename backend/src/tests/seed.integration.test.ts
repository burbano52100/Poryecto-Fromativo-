import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert';
import { pool } from '../db/index.js';
import { runSeed } from '../db/seed.js';
import { fechaBogota } from '../utils/horario.js';
import { cleanDatabase } from './helpers/db.js';
import { fijarHoraBogota, restaurarReloj } from './helpers/tiempo.js';

const q = async <T = Record<string, unknown>>(sql: string): Promise<T[]> => (await pool.query(sql)).rows as T[];

describe('Semilla de demostración', () => {
  let ventasPrimeraVez = 0;

  beforeAll(async () => {
    await cleanDatabase();
    // 8:30 p. m. en Colombia: la fecha UTC ya es la de mañana, que es cuando fallaba toISOString()
    fijarHoraBogota(20, 30);
    await runSeed();
    ventasPrimeraVez = (await q<{ n: number }>('SELECT count(*)::int AS n FROM ventas'))[0].n;
    // Correrla de nuevo no debe duplicar ni descuadrar nada
    await runSeed();
  }, 60000);

  afterAll(() => restaurarReloj());

  it('crea el menú activo con la fecha de hoy en Colombia', async () => {
    const [menu] = await q<{ fecha: string }>(
      "SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha FROM menus_dia WHERE nombre = 'Menú Ejecutivo SENA'"
    );
    assert.strictEqual(menu.fecha, fechaBogota());
  });

  it('las porciones vendidas de cada menú son sus ventas completadas', async () => {
    const descuadres = await q(
      `SELECT m.nombre, m.cantidad_vendida,
              (SELECT count(*) FROM ventas v WHERE v.menu_id = m.id AND v.estado = 'completada')::int AS ventas
       FROM menus_dia m
       WHERE m.cantidad_vendida <> (SELECT count(*) FROM ventas v WHERE v.menu_id = m.id AND v.estado = 'completada')`
    );
    assert.deepStrictEqual(descuadres, []);
  });

  it('la deuda de cada instructor es la suma de sus ventas a crédito pendientes', async () => {
    const deudas = await q<{ monto: number; almuerzos: number; pendiente: number; n: number }>(
      `SELECT d.monto::float8 AS monto, d.almuerzos_pendientes AS almuerzos,
              (SELECT sum(v.precio_cobrado) FROM ventas v
                WHERE v.usuario_id = d.usuario_id AND v.estado_pago = 'pendiente')::float8 AS pendiente,
              (SELECT count(*) FROM ventas v
                WHERE v.usuario_id = d.usuario_id AND v.estado_pago = 'pendiente')::int AS n
       FROM deudas d`
    );
    assert.ok(deudas.length > 0, 'la semilla debe crear al menos una deuda');
    for (const d of deudas) {
      assert.strictEqual(d.monto, d.pendiente);
      assert.strictEqual(d.almuerzos, d.n);
    }
  });

  it('es idempotente: la segunda ejecución no duplica ventas', async () => {
    const [{ n }] = await q<{ n: number }>('SELECT count(*)::int AS n FROM ventas');
    assert.strictEqual(n, ventasPrimeraVez);
  });

  it('ningún material de la demo está vencido', async () => {
    const vencidos = await q("SELECT nombre FROM materiales WHERE fecha_vencimiento < (NOW() AT TIME ZONE 'America/Bogota')::date");
    assert.deepStrictEqual(vencidos, []);
  });
});
