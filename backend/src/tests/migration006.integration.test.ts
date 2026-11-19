/**
 * Migración 006: eliminación del perfil invitado (ADR 016).
 * La migración se prueba de verdad en un esquema aparte: se aplican la 001 a la 005, se cargan
 * datos de un invitado y de otros roles, y se corre la 006. La BD de test ya la tiene aplicada.
 */
import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import type { PoolClient } from 'pg';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';

const ESQUEMA = 'prueba_migracion_006';
const MIGRACIONES_PREVIAS = [
  '001_initial_schema.sql',
  '002_add_beneficiarios_and_estado_pago.sql',
  '003_fix_estado_pago_ventas_previas.sql',
  '004_kardex_saldos_iniciales_y_mermas_huerfanas.sql',
  '005_solicitudes_cuenta.sql',
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

  const usuario = async (clave: string, nombre: string, cedula: string, rol: string) => {
    ids[clave] = (
      await uno<{ id: string }>('INSERT INTO usuarios (nombre, cedula, rol) VALUES ($1, $2, $3) RETURNING id;', [nombre, cedula, rol])
    ).id;
  };
  await usuario('encargado', 'Encargado', '6000000001', 'encargado');
  await usuario('aprendiz', 'Aprendiz', '6000000002', 'aprendiz');
  await usuario('invitado', 'Invitado Particular', '6000000003', 'invitado');

  ids.menu = (
    await uno<{ id: string }>(
      `INSERT INTO menus_dia (fecha, nombre, precio_aprendiz, precio_invitado, cantidad_disponible, cantidad_vendida, estado)
       VALUES (CURRENT_DATE, 'Menú', 5000, 8000, 50, 2, 'activo') RETURNING id;`
    )
  ).id;
  await client.query(
    `INSERT INTO ventas (usuario_id, menu_id, precio_cobrado, metodo_pago, estado_pago)
     VALUES ($1, $3, 5000, 'efectivo', 'pendiente'), ($2, $3, 8000, 'efectivo', 'pagado');`,
    [ids.aprendiz, ids.invitado, ids.menu]
  );
  await client.query(
    `INSERT INTO sugerencias (usuario_id, asunto, mensaje)
     VALUES ($1, 'Del aprendiz', 'Mensaje del aprendiz'), ($2, 'Del invitado', 'Mensaje del invitado');`,
    [ids.aprendiz, ids.invitado]
  );
  await client.query('INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes) VALUES ($1, 8000, 1);', [ids.invitado]);
  await client.query(
    `INSERT INTO solicitudes_cuenta (nombre, cedula, email, password_hash, rol)
     VALUES ('Instructora', '6000000004', 'instructora@sena.edu.co', 'hash', 'instructor');`
  );

  await client.query(await leerMigracion('006_eliminar_perfil_invitado.sql'));
}, 60000);

afterAll(async () => {
  await client.query(`RESET search_path; DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE;`);
  client.release();
});

describe('Migración 006: elimina el perfil invitado', () => {
  it('borra los usuarios invitados y conserva los demás roles', async () => {
    const roles = (await client.query('SELECT rol::text AS rol FROM usuarios ORDER BY rol;')).rows.map((r) => r.rol);
    assert.deepStrictEqual(roles, ['aprendiz', 'encargado']);
  });

  it('borra las ventas, la deuda y las sugerencias del invitado, pero no las del aprendiz', async () => {
    assert.strictEqual((await uno<{ n: number }>('SELECT count(*)::int AS n FROM ventas;')).n, 1);
    assert.strictEqual((await uno<{ id: string }>('SELECT usuario_id AS id FROM ventas;')).id, ids.aprendiz);
    assert.strictEqual((await uno<{ n: number }>('SELECT count(*)::int AS n FROM deudas;')).n, 0);
    const sugerencias = (await client.query('SELECT asunto FROM sugerencias;')).rows.map((r) => r.asunto);
    assert.deepStrictEqual(sugerencias, ['Del aprendiz']);
  });

  it('la porción que había reservado el invitado vuelve al cupo del menú', async () => {
    assert.strictEqual((await uno<{ n: number }>('SELECT cantidad_vendida AS n FROM menus_dia;')).n, 1);
  });

  it("el enum rol_usuario ya no tiene 'invitado'", async () => {
    const valores = (
      await client.query("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'rol_usuario'::regtype ORDER BY enumsortorder;")
    ).rows.map((r) => r.enumlabel);
    assert.deepStrictEqual(valores, ['aprendiz', 'instructor', 'encargado']);
    await assert.rejects(
      client.query("INSERT INTO usuarios (nombre, cedula, rol) VALUES ('Otro', '6000000009', 'invitado');"),
      { code: '22P02' }
    );
  });

  it('las solicitudes de cuenta conservan sus datos y su restricción de rol', async () => {
    assert.strictEqual((await uno<{ rol: string }>('SELECT rol::text AS rol FROM solicitudes_cuenta;')).rol, 'instructor');
    await assert.rejects(
      client.query(
        `INSERT INTO solicitudes_cuenta (nombre, cedula, email, password_hash, rol)
         VALUES ('Aprendiz', '6000000005', 'aprendiz@misena.edu.co', 'hash', 'aprendiz');`
      ),
      { code: '23514' }
    );
  });

  it('quita la columna precio_invitado del menú', async () => {
    const columna = await uno(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'menus_dia' AND column_name = 'precio_invitado';`,
      [ESQUEMA]
    );
    assert.strictEqual(columna, undefined);
  });

  it('es idempotente: correrla otra vez no falla ni cambia nada', async () => {
    await client.query(await leerMigracion('006_eliminar_perfil_invitado.sql'));
    assert.strictEqual((await uno<{ n: number }>('SELECT count(*)::int AS n FROM usuarios;')).n, 2);
  });
});

describe('Sin perfil invitado en la API', () => {
  const app = createApp();

  beforeAll(async () => {
    await cleanDatabase();
  });

  it('el registro rechaza el tipo de cuenta invitado', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Persona Externa',
      document: '6100000001',
      accountType: 'invitado',
      email: 'externa@correo.com',
      password: 'clave-segura-123',
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /tipo de cuenta no es válido/);
    assert.strictEqual((await pool.query('SELECT count(*)::int AS n FROM usuarios;')).rows[0].n, 0);
  });

  it('un token emitido para un invitado ya no da acceso (401)', async () => {
    const token = jwt.sign(
      { id: '00000000-0000-4000-8000-000000000099', document: '6100000002', name: 'Invitado', role: 'invitado' },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.status, 401);
  });

  it('el menú activo ya no trae precio_invitado', async () => {
    const res = await request(app).get('/api/menus/activo');
    assert.strictEqual(res.status, 200);
    assert.ok(!('precio_invitado' in res.body));
  });
});
