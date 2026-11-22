import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import { pool } from '../db/index.js';
import { bootstrapAdmin } from '../db/bootstrapAdmin.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario } from './helpers/auth.js';

const VARIABLES = [
  'ADMIN_DOCUMENT',
  'ADMIN_PASSWORD',
  'ADMIN_NAME',
  'ADMIN_EMAIL',
  'COORDINADOR_DOCUMENT',
  'COORDINADOR_PASSWORD',
  'COORDINADOR_NAME',
  'COORDINADOR_EMAIL',
] as const;

interface Cuenta {
  nombre: string;
  cedula: string;
  email: string;
  estado: string;
  password_hash: string;
}

const cuentasDe = async (rol: string): Promise<Cuenta[]> =>
  (
    await pool.query<Cuenta>(
      'SELECT nombre, cedula, email, estado, password_hash FROM usuarios WHERE rol = $1 ORDER BY cedula;',
      [rol]
    )
  ).rows;

describe('Bootstrap de las cuentas iniciales', () => {
  const originales = new Map<string, string | undefined>();

  beforeEach(async () => {
    await cleanDatabase();
    for (const nombre of VARIABLES) {
      originales.set(nombre, process.env[nombre]);
      delete process.env[nombre];
    }
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const nombre of VARIABLES) {
      const valor = originales.get(nombre);
      if (valor === undefined) delete process.env[nombre];
      else process.env[nombre] = valor;
    }
    vi.restoreAllMocks();
  });

  it('crea el primer encargado y el primer coordinador, activos y con su contraseña', async () => {
    process.env.ADMIN_DOCUMENT = '1012345678';
    process.env.ADMIN_PASSWORD = 'ClaveEncargado1';
    process.env.COORDINADOR_DOCUMENT = '1023456789';
    process.env.COORDINADOR_PASSWORD = 'ClaveCoordinador1';
    process.env.COORDINADOR_NAME = 'Coordinación Yamboró';
    process.env.COORDINADOR_EMAIL = 'Coordinacion.Yamboro@SENA.edu.co';

    await bootstrapAdmin();

    const [encargado] = await cuentasDe('encargado');
    assert.strictEqual(encargado.cedula, '1012345678');
    assert.strictEqual(encargado.estado, 'activo');
    assert.ok(await bcrypt.compare('ClaveEncargado1', encargado.password_hash));

    const coordinadores = await cuentasDe('coordinador');
    assert.strictEqual(coordinadores.length, 1);
    const [coordinador] = coordinadores;
    assert.strictEqual(coordinador.cedula, '1023456789');
    assert.strictEqual(coordinador.nombre, 'Coordinación Yamboró');
    assert.strictEqual(coordinador.email, 'coordinacion.yamboro@sena.edu.co');
    assert.strictEqual(coordinador.estado, 'activo');
    assert.ok(await bcrypt.compare('ClaveCoordinador1', coordinador.password_hash));
  });

  it('usa nombre y correo por defecto cuando no se definen', async () => {
    process.env.COORDINADOR_DOCUMENT = '1023456789';
    process.env.COORDINADOR_PASSWORD = 'ClaveCoordinador1';

    await bootstrapAdmin();

    const [coordinador] = await cuentasDe('coordinador');
    assert.strictEqual(coordinador.nombre, 'Coordinación Académica');
    assert.strictEqual(coordinador.email, 'coordinacion@sena.edu.co');
    // Sin ADMIN_* no se crea el encargado, pero eso no impide crear el coordinador
    assert.deepStrictEqual(await cuentasDe('encargado'), []);
  });

  it('no crea nada sin documento o sin contraseña', async () => {
    process.env.ADMIN_DOCUMENT = '1012345678';
    process.env.COORDINADOR_PASSWORD = 'ClaveCoordinador1';

    await bootstrapAdmin();

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM usuarios;');
    assert.strictEqual(rows[0].n, 0);
  });

  it('correrlo en cada arranque no duplica ni cambia las cuentas existentes', async () => {
    process.env.COORDINADOR_DOCUMENT = '1023456789';
    process.env.COORDINADOR_PASSWORD = 'ClaveCoordinador1';
    await bootstrapAdmin();

    // Otro arranque con otros valores: ya hay un coordinador, así que no se toca
    process.env.COORDINADOR_DOCUMENT = '1099999999';
    process.env.COORDINADOR_PASSWORD = 'OtraClave1';
    await bootstrapAdmin();

    const coordinadores = await cuentasDe('coordinador');
    assert.strictEqual(coordinadores.length, 1);
    assert.strictEqual(coordinadores[0].cedula, '1023456789');
    assert.ok(await bcrypt.compare('ClaveCoordinador1', coordinadores[0].password_hash));
  });

  it('no convierte en coordinador una cuenta que ya usa ese documento o ese correo', async () => {
    await crearUsuario('Instructor con el documento', '1023456789', 'instructor');
    await crearUsuario('Aprendiz con el correo', '1005000001', 'aprendiz', { email: 'coordinacion@sena.edu.co' });

    process.env.COORDINADOR_DOCUMENT = '1023456789';
    process.env.COORDINADOR_PASSWORD = 'ClaveCoordinador1';
    await bootstrapAdmin();
    assert.deepStrictEqual(await cuentasDe('coordinador'), []);

    process.env.COORDINADOR_DOCUMENT = '1088888888';
    await bootstrapAdmin();
    assert.deepStrictEqual(await cuentasDe('coordinador'), []);

    const { rows } = await pool.query<{ rol: string }>(
      "SELECT rol FROM usuarios WHERE cedula = '1023456789' OR email = 'coordinacion@sena.edu.co' ORDER BY rol;"
    );
    assert.deepStrictEqual(
      rows.map((r) => r.rol),
      ['aprendiz', 'instructor']
    );
  });
});
