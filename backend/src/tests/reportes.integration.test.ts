import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { binario, leerXlsx } from './helpers/archivos.js';
import { TIPOS_REPORTE } from '../services/reportes.service.js';
import { fechaRelativa } from './helpers/fechas.js';

const app = createApp();
let encargado: UsuarioTest;
let coordinador: UsuarioTest;
let aprendiz: UsuarioTest;

const descargar = (tipo: string, token: string, params: Record<string, string> = {}) =>
  request(app).get(`/api/reportes/${tipo}`).query(params).set('Authorization', `Bearer ${token}`).buffer(true).parse(binario);

beforeAll(async () => {
  await cleanDatabase();
  encargado = await crearUsuario('Encargado Reportes', '8800000001', 'encargado');
  coordinador = await crearUsuario('Coordinador Reportes', '8800000002', 'coordinador');
  aprendiz = await crearUsuario('Aprendiz Reportes', '8800000003', 'aprendiz');
  await pool.query(
    `INSERT INTO almuerzos_invitados (tipo, cantidad, precio_unitario, nombre_invitado, registrado_por)
     VALUES ('corriente', 2, 11000, '=HYPERLINK("http://malo")', $1), ('instructor', 1, 10000, 'Visitante', $1);`,
    [encargado.id]
  );
});

describe('Reportes PDF y Excel', () => {
  it('cada reporte del encargado se descarga en PDF y en Excel', async () => {
    for (const tipo of TIPOS_REPORTE.filter((t) => t !== 'usuarios')) {
      const pdf = await descargar(tipo, encargado.token, { formato: 'pdf' });
      assert.strictEqual(pdf.status, 200, `${tipo}: ${pdf.body.toString().slice(0, 200)}`);
      assert.strictEqual(pdf.headers['content-type'], 'application/pdf');
      assert.strictEqual(pdf.body.subarray(0, 4).toString(), '%PDF');
      assert.match(pdf.headers['content-disposition'], new RegExp(`reporte-${tipo}-.*\\.pdf`));

      const xlsx = await descargar(tipo, encargado.token, { formato: 'xlsx' });
      assert.strictEqual(xlsx.status, 200, tipo);
      assert.match(xlsx.headers['content-type'], /spreadsheetml/);
    }
  });

  it('el Excel lleva título, rango, fecha de generación, pesos y neutraliza las fórmulas', async () => {
    const hoy = fechaRelativa(0);
    const res = await descargar('almuerzos-invitados', encargado.token, { formato: 'xlsx', desde: hoy, hasta: hoy });
    const filas = await leerXlsx(res.body);
    assert.strictEqual(filas[0][0], 'GastroSENA · Almuerzos Invitados');
    const [anio, mes, dia] = hoy.split('-');
    assert.strictEqual(filas[1][0], `Del ${dia}/${mes}/${anio} al ${dia}/${mes}/${anio}`);
    assert.match(filas[2][0], /^Generado el/);
    const malicioso = filas.find((f) => f.some((c) => c?.includes('HYPERLINK')))!;
    assert.ok(malicioso.some((c) => c.startsWith("'=")), 'la celda que empieza con = se neutraliza');
    assert.ok(filas.some((f) => f.some((c) => /Total: 3 persona\(s\), \$32\.000/.test(c ?? ''))));
  });

  it('respeta los filtros: un rango sin datos no trae filas', async () => {
    const res = await descargar('almuerzos-invitados', encargado.token, {
      formato: 'xlsx',
      desde: fechaRelativa(-10),
      hasta: fechaRelativa(-9),
    });
    const filas = await leerXlsx(res.body);
    assert.ok(!filas.some((f) => f.includes('Visitante')));
  });

  it('cada reporte solo lo descargan los roles que ven el módulo', async () => {
    assert.strictEqual((await descargar('ventas', coordinador.token)).status, 403);
    assert.strictEqual((await descargar('usuarios', encargado.token)).status, 403);
    assert.strictEqual((await descargar('ventas', aprendiz.token)).status, 403);
    assert.strictEqual((await descargar('usuarios', coordinador.token, { formato: 'xlsx', estado: 'activo' })).status, 200);
    assert.strictEqual((await descargar('no-existe', encargado.token)).status, 400);
    assert.strictEqual((await descargar('ventas', encargado.token, { formato: 'doc' })).status, 400);
  });
});
