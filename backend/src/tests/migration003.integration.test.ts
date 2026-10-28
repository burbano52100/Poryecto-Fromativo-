import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';

const MIGRATION_003 = new URL('../db/migrations/003_fix_estado_pago_ventas_previas.sql', import.meta.url);

interface VentaCaso {
  etiqueta: string;
  metodo: 'saldo' | 'efectivo' | 'credito' | 'cortesia';
  precio: number;
  estadoInicial: 'pendiente' | 'pagado' | 'gratis';
  previa: boolean;
  esperado: 'pendiente' | 'pagado' | 'gratis';
}

const casos: VentaCaso[] = [
  // Ventas anteriores a la 002: se corrigen
  { etiqueta: 'previa-saldo', metodo: 'saldo', precio: 5000, estadoInicial: 'pendiente', previa: true, esperado: 'pagado' },
  { etiqueta: 'previa-efectivo', metodo: 'efectivo', precio: 8000, estadoInicial: 'pendiente', previa: true, esperado: 'pagado' },
  { etiqueta: 'previa-credito', metodo: 'credito', precio: 5000, estadoInicial: 'pagado', previa: true, esperado: 'pendiente' },
  { etiqueta: 'previa-cortesia', metodo: 'cortesia', precio: 0, estadoInicial: 'pendiente', previa: true, esperado: 'gratis' },
  // Empates: precio 0 con otro método -> gana 'gratis'
  { etiqueta: 'previa-saldo-0', metodo: 'saldo', precio: 0, estadoInicial: 'pendiente', previa: true, esperado: 'gratis' },
  { etiqueta: 'previa-credito-0', metodo: 'credito', precio: 0, estadoInicial: 'pendiente', previa: true, esperado: 'gratis' },
  // Ventas posteriores a la 002: no se tocan
  { etiqueta: 'post-saldo', metodo: 'saldo', precio: 5000, estadoInicial: 'pendiente', previa: false, esperado: 'pendiente' },
  { etiqueta: 'post-efectivo', metodo: 'efectivo', precio: 8000, estadoInicial: 'pendiente', previa: false, esperado: 'pendiente' },
  { etiqueta: 'post-credito', metodo: 'credito', precio: 5000, estadoInicial: 'pagado', previa: false, esperado: 'pagado' },
  { etiqueta: 'post-saldo-0', metodo: 'saldo', precio: 0, estadoInicial: 'pendiente', previa: false, esperado: 'pendiente' },
];

beforeAll(async () => {
  await cleanDatabase();

  const corteRes = await pool.query(
    "SELECT applied_at FROM schema_migrations WHERE version = '002_add_beneficiarios_and_estado_pago.sql';"
  );
  assert.strictEqual(corteRes.rows.length, 1, 'La migración 002 debe estar registrada en la BD de test');
  const corte: Date = corteRes.rows[0].applied_at;

  const userRes = await pool.query(
    "INSERT INTO usuarios (nombre, cedula, rol) VALUES ('Usuario 003', '9000000300', 'aprendiz') RETURNING id;"
  );
  const usuarioId = userRes.rows[0].id;

  for (const caso of casos) {
    // Un menú por venta para no chocar con el índice único (usuario_id, menu_id)
    const menuRes = await pool.query(
      `INSERT INTO menus_dia (fecha, nombre, precio_aprendiz, precio_invitado, estado)
       VALUES (CURRENT_DATE, $1, 5000, 8000, 'completado') RETURNING id;`,
      [caso.etiqueta]
    );
    await pool.query(
      `INSERT INTO ventas (usuario_id, menu_id, precio_cobrado, metodo_pago, estado_pago, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz + ($7 || ' day')::interval);`,
      [usuarioId, menuRes.rows[0].id, caso.precio, caso.metodo, caso.estadoInicial, corte, caso.previa ? '-1' : '1']
    );
  }

  const sql = await readFile(MIGRATION_003, 'utf8');
  await pool.query(sql);
});

describe('Migración 003: corrección de estado_pago en ventas previas', () => {
  for (const caso of casos) {
    it(`${caso.etiqueta}: ${caso.metodo} $${caso.precio} (${caso.estadoInicial}) -> ${caso.esperado}`, async () => {
      const res = await pool.query(
        `SELECT v.estado_pago FROM ventas v JOIN menus_dia m ON m.id = v.menu_id WHERE m.nombre = $1;`,
        [caso.etiqueta]
      );
      assert.strictEqual(res.rows[0].estado_pago, caso.esperado);
    });
  }
});
