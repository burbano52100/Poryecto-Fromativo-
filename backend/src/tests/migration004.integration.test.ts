import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';

const MIGRATION_004 = new URL('../db/migrations/004_kardex_saldos_iniciales_y_mermas_huerfanas.sql', import.meta.url);

let sql: string;
const ids: Record<string, string> = {};

const crearMaterial = async (nombre: string, stock: number, creado: string): Promise<string> => {
  const res = await pool.query(
    `INSERT INTO materiales (codigo_barras, nombre, unidad_medida, stock_actual, created_at)
     VALUES ($1, $1, 'Kg', $2, $3::timestamptz) RETURNING id;`,
    [nombre, stock, creado]
  );
  return res.rows[0].id;
};

const crearMermaHuerfana = async (materialId: string, cantidad: number, fecha: string) => {
  await pool.query(
    `INSERT INTO mermas (material_id, cantidad_perdida, unidad, razon, fecha_hora)
     VALUES ($1, $2, 'Kg', 'Prueba', $3::timestamptz);`,
    [materialId, cantidad, fecha]
  );
};

const ultimoSaldo = async (materialId: string): Promise<number | null> => {
  const res = await pool.query(
    `SELECT saldo_resultante::float8 AS saldo FROM movimientos_kardex
     WHERE material_id = $1 ORDER BY fecha_hora DESC, created_at DESC LIMIT 1;`,
    [materialId]
  );
  return res.rows[0]?.saldo ?? null;
};

const conteos = async () => {
  const res = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM movimientos_kardex) AS kardex,
            (SELECT COUNT(*)::int FROM mermas WHERE movimiento_kardex_id IS NULL) AS huerfanas;`
  );
  return res.rows[0];
};

beforeAll(async () => {
  await cleanDatabase();
  sql = await readFile(MIGRATION_004, 'utf8');

  // A: stock 45 con una merma huérfana de 2.5 (caso real del seed)
  ids.A = await crearMaterial('A-arroz', 45, '2026-10-01 10:00:00-05');
  await crearMermaHuerfana(ids.A, 2.5, '2026-10-01 10:00:01-05');
  // B: sin movimientos ni mermas
  ids.B = await crearMaterial('B-sin-mov', 10, '2026-10-01 10:00:00-05');
  // C: stock 0 sin movimientos
  ids.C = await crearMaterial('C-cero', 0, '2026-10-01 10:00:00-05');
  // D: dos mermas huérfanas
  ids.D = await crearMaterial('D-dos-mermas', 7, '2026-10-01 10:00:00-05');
  await crearMermaHuerfana(ids.D, 1.25, '2026-10-02 09:00:00-05');
  await crearMermaHuerfana(ids.D, 0.75, '2026-10-03 09:00:00-05');
  // E: ya tenía su movimiento, no debe recibir otro saldo inicial
  ids.E = await crearMaterial('E-con-mov', 20, '2026-10-01 10:00:00-05');
  await pool.query(
    `INSERT INTO movimientos_kardex (material_id, tipo, concepto, cantidad_entrada, saldo_resultante)
     VALUES ($1, 'entrada', 'Ingreso inicial de material', 20, 20);`,
    [ids.E]
  );

  await pool.query(sql);
});

describe('Migración 004: kardex coherente con el stock', () => {
  it('el último saldo del kardex coincide con stock_actual en todos los materiales', async () => {
    const res = await pool.query(
      `SELECT m.nombre, m.stock_actual::float8 AS stock, k.saldo::float8 AS saldo
       FROM materiales m
       LEFT JOIN LATERAL (
         SELECT saldo_resultante AS saldo FROM movimientos_kardex
         WHERE material_id = m.id ORDER BY fecha_hora DESC, created_at DESC LIMIT 1
       ) k ON true;`
    );
    for (const row of res.rows) {
      assert.strictEqual(row.saldo, row.stock, `${row.nombre}: saldo ${row.saldo} != stock ${row.stock}`);
    }
  });

  it('no cambia stock_actual', async () => {
    const res = await pool.query('SELECT nombre, stock_actual::float8 AS stock FROM materiales ORDER BY nombre;');
    assert.deepStrictEqual(
      res.rows.map((r) => [r.nombre, r.stock]),
      [['A-arroz', 45], ['B-sin-mov', 10], ['C-cero', 0], ['D-dos-mermas', 7], ['E-con-mov', 20]]
    );
  });

  it('reconstruye la cadena entrada -> mermas con saldos correctos', async () => {
    const res = await pool.query(
      `SELECT tipo, cantidad_entrada::float8 AS entrada, cantidad_salida::float8 AS salida, saldo_resultante::float8 AS saldo
       FROM movimientos_kardex WHERE material_id = $1 ORDER BY fecha_hora;`,
      [ids.D]
    );
    assert.deepStrictEqual(res.rows, [
      { tipo: 'entrada', entrada: 9, salida: null, saldo: 9 },
      { tipo: 'merma', entrada: null, salida: 1.25, saldo: 7.75 },
      { tipo: 'merma', entrada: null, salida: 0.75, saldo: 7 },
    ]);
    assert.strictEqual(await ultimoSaldo(ids.A), 45);
  });

  it('enlaza cada merma con su movimiento', async () => {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS n FROM mermas mer
       JOIN movimientos_kardex k ON k.id = mer.movimiento_kardex_id
       WHERE k.tipo = 'merma' AND k.cantidad_salida = mer.cantidad_perdida;`
    );
    assert.strictEqual(res.rows[0].n, 3);
    assert.strictEqual((await conteos()).huerfanas, 0);
  });

  it('no agrega saldo inicial a materiales que ya tenían movimientos', async () => {
    const res = await pool.query('SELECT COUNT(*)::int AS n FROM movimientos_kardex WHERE material_id = $1;', [ids.E]);
    assert.strictEqual(res.rows[0].n, 1);
  });

  it('es idempotente: correrla otra vez no duplica nada', async () => {
    const antes = await conteos();
    await pool.query(sql);
    const despues = await conteos();
    assert.deepStrictEqual(despues, antes);
    // A, B, C y D: 1 entrada cada uno + 3 mermas; E: su movimiento original
    assert.strictEqual(despues.kardex, 8);
  });
});
