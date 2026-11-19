/**
 * Migración 008: institución y responsable de las visitas como texto libre.
 * Se prueba en un esquema aparte: se aplican la 001 a la 007, se cargan visitas con el modelo
 * viejo (ids de institución e instructor) y se corre la 008. La BD de test ya la tiene aplicada.
 */
import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import type { PoolClient } from 'pg';
import { pool } from '../db/index.js';

const ESQUEMA = 'prueba_migracion_008';
const MIGRACIONES_PREVIAS = [
  '001_initial_schema.sql',
  '002_add_beneficiarios_and_estado_pago.sql',
  '003_fix_estado_pago_ventas_previas.sql',
  '004_kardex_saldos_iniciales_y_mermas_huerfanas.sql',
  '005_solicitudes_cuenta.sql',
  '006_eliminar_perfil_invitado.sql',
  '007_almuerzos_invitados.sql',
];

const leerMigracion = (archivo: string) => readFile(new URL(`../db/migrations/${archivo}`, import.meta.url), 'utf8');

let client: PoolClient;
const ids: Record<string, string> = {};

const uno = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> =>
  (await client.query(sql, params)).rows[0] as T;

beforeAll(async () => {
  client = await pool.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE; CREATE SCHEMA ${ESQUEMA};`);
  await client.query(`SET search_path TO ${ESQUEMA}, public;`);
  for (const archivo of MIGRACIONES_PREVIAS) {
    await client.query(await leerMigracion(archivo));
  }

  ids.instructora = (
    await uno<{ id: string }>(
      "INSERT INTO usuarios (nombre, cedula, rol) VALUES ('María Fernanda Gómez (Instructor SENA)', '6800000001', 'instructor') RETURNING id;"
    )
  ).id;
  ids.colegio = (await uno<{ id: string }>("INSERT INTO instituciones (nombre) VALUES ('Colegio San José') RETURNING id;")).id;
  ids.universidad = (
    await uno<{ id: string }>("INSERT INTO instituciones (nombre, tipo) VALUES ('Universidad Surcolombiana', 'universidad') RETURNING id;")
  ).id;

  // Una visita con instructor SENA y otra con responsable externo
  ids.visitaInterna = (
    await uno<{ id: string }>(
      `INSERT INTO visitas_institucionales (institucion_id, instructor_id, cantidad_personas, fecha_visita, precio_unitario)
       VALUES ($1, $2, 25, '2026-10-20', 8000) RETURNING id;`,
      [ids.colegio, ids.instructora]
    )
  ).id;
  ids.visitaExterna = (
    await uno<{ id: string }>(
      `INSERT INTO visitas_institucionales (institucion_id, nombre_instructor_ext, cantidad_personas, fecha_visita, precio_unitario)
       VALUES ($1, '  Pedro Externo  ', 10, '2026-11-02', 11000) RETURNING id;`,
      [ids.universidad]
    )
  ).id;

  await client.query(await leerMigracion('008_visitas_nombres_texto.sql'));
}, 60000);

afterAll(async () => {
  await client.query(`RESET search_path; DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE;`);
  client.release();
});

const visita = (id: string) =>
  uno<{ institucion_nombre: string; responsable_nombre: string; total: number }>(
    'SELECT institucion_nombre, responsable_nombre, total_a_cobrar::float8 AS total FROM visitas_institucionales WHERE id = $1;',
    [id]
  );

describe('Migración 008: visitas con nombres en texto', () => {
  it('copia la institución y el instructor SENA de las visitas existentes, sin el sufijo "(Instructor SENA)"', async () => {
    assert.deepStrictEqual(await visita(ids.visitaInterna), {
      institucion_nombre: 'Colegio San José',
      responsable_nombre: 'María Fernanda Gómez',
      total: 200000,
    });
  });

  it('copia el responsable externo sin espacios sobrantes', async () => {
    assert.deepStrictEqual(await visita(ids.visitaExterna), {
      institucion_nombre: 'Universidad Surcolombiana',
      responsable_nombre: 'Pedro Externo',
      total: 110000,
    });
  });

  it('acepta visitas nuevas solo con los nombres y exige que no estén vacíos ni pasen de 150', async () => {
    const insertar = (institucion: string | null, responsable: string | null) =>
      client.query(
        `INSERT INTO visitas_institucionales (institucion_nombre, responsable_nombre, cantidad_personas, fecha_visita, precio_unitario)
         VALUES ($1, $2, 4, CURRENT_DATE, 11000);`,
        [institucion, responsable]
      );
    await insertar('Colegio Nuevo', 'Ana Responsable');
    await assert.rejects(insertar(null, 'Ana'), { code: '23502' });
    await assert.rejects(insertar('Colegio', '  '), { code: '23514' });
    await assert.rejects(insertar('c'.repeat(151), 'Ana'), { code: '23514' });
  });

  it('borrar una institución ya no borra sus visitas', async () => {
    await client.query('DELETE FROM instituciones WHERE id = $1;', [ids.colegio]);
    assert.strictEqual((await visita(ids.visitaInterna)).institucion_nombre, 'Colegio San José');
  });

  it('es idempotente: correrla otra vez no falla ni cambia los nombres', async () => {
    await client.query(await leerMigracion('008_visitas_nombres_texto.sql'));
    assert.strictEqual((await visita(ids.visitaExterna)).responsable_nombre, 'Pedro Externo');
  });
});
