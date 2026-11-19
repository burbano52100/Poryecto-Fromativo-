import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';

const app = createApp();
let encargado: UsuarioTest;
let coordinador: UsuarioTest;
let aprendiz: UsuarioTest;

const auditoria = (token: string, params: Record<string, string | number> = {}) =>
  request(app).get('/api/auditoria').query(params).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  await cleanDatabase();
  encargado = await crearUsuario('Encargada Auditoría', '9100000001', 'encargado');
  coordinador = await crearUsuario('Coordinador Auditoría', '9100000002', 'coordinador');
  aprendiz = await crearUsuario('Aprendiz Auditoría', '9100000003', 'aprendiz');
});

describe('Tabla auditoria: solo inserción', () => {
  it('impide editar y borrar registros', async () => {
    await registrarAuditoria({ usuario: null, accion: 'crear', entidad: 'configuracion', despues: { prueba: true } });
    await assert.rejects(pool.query("UPDATE auditoria SET accion = 'eliminar';"), { code: '42501' });
    await assert.rejects(pool.query('DELETE FROM auditoria;'), { code: '42501' });
    const fila = (await pool.query("SELECT usuario_nombre, rol FROM auditoria WHERE entidad = 'configuracion';")).rows[0];
    assert.deepStrictEqual(fila, { usuario_nombre: 'Sistema', rol: 'sistema' });
  });
});

describe('Acciones auditadas', () => {
  it('publicar un menú y cambiar la configuración quedan con quién, qué y el antes/después', async () => {
    const menu = await request(app)
      .post('/api/menus')
      .set('Authorization', `Bearer ${encargado.token}`)
      .send({ nombre: 'Menú Auditado', fecha: '2026-11-20', precio_aprendiz: 5000, cantidad_disponible: 50, estado: 'borrador' });
    assert.strictEqual(menu.status, 201, JSON.stringify(menu.body));

    const config = await request(app)
      .put('/api/configuracion')
      .set('Authorization', `Bearer ${encargado.token}`)
      .send({ sugerencia_margen_pct: 15 });
    assert.strictEqual(config.status, 200, JSON.stringify(config.body));

    const res = await auditoria(encargado.token, { entidad: 'configuracion', accion: 'configurar' });
    assert.strictEqual(res.status, 200);
    const [registro] = res.body.items;
    assert.strictEqual(registro.usuario_nombre, 'Encargada Auditoría');
    assert.strictEqual(registro.rol, 'encargado');
    assert.strictEqual(registro.datos_antes.sugerencia_margen_pct, 10);
    assert.strictEqual(registro.datos_despues.sugerencia_margen_pct, 15);

    const menus = await auditoria(encargado.token, { entidad: 'menu_dia' });
    assert.strictEqual(menus.body.items[0].accion, 'crear');
    assert.strictEqual(menus.body.items[0].datos_despues.nombre, 'Menú Auditado');
  });
});

describe('GET /api/auditoria', () => {
  it('filtra por usuario, pagina y devuelve el total', async () => {
    const res = await auditoria(encargado.token, { usuario: 'encargada', tamano: 1, pagina: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.items.length, 1);
    assert.ok(res.body.total >= 2);
    const pagina2 = await auditoria(encargado.token, { usuario: 'encargada', tamano: 1, pagina: 2 });
    assert.notStrictEqual(pagina2.body.items[0].id, res.body.items[0].id);
  });

  it('el coordinador solo ve sus propias acciones', async () => {
    await registrarAuditoria({ usuario: coordinador, accion: 'aprobar', entidad: 'cuenta', entidadId: 'x' });
    const res = await auditoria(coordinador.token);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.items.length >= 1);
    assert.ok(res.body.items.every((r: any) => r.usuario_id === coordinador.id));
    // Aunque intente filtrar por el encargado, no ve sus registros
    const ajenos = await auditoria(coordinador.token, { usuario: 'Encargada' });
    assert.strictEqual(ajenos.body.items.length, 0);
    const opciones = await request(app).get('/api/auditoria/opciones').set('Authorization', `Bearer ${coordinador.token}`);
    assert.deepStrictEqual(opciones.body.entidades, ['cuenta']);
  });

  it('valida el rango y responde 403 a los demás roles', async () => {
    assert.strictEqual((await auditoria(encargado.token, { desde: '2026-11-10', hasta: '2026-11-01' })).status, 400);
    assert.strictEqual((await auditoria(aprendiz.token)).status, 403);
  });
});
