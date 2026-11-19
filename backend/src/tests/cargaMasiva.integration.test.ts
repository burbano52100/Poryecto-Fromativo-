import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { binario, crearXlsx, leerXlsx } from './helpers/archivos.js';

const app = createApp();
let coordinador: UsuarioTest;

const enviar = (tipo: string, paso: 'previsualizar' | 'confirmar', archivo: Buffer, nombre: string) =>
  request(app)
    .post(`/api/coordinador/cargas/${tipo}/${paso}`)
    .set('Authorization', `Bearer ${coordinador.token}`)
    .set('Content-Type', 'application/octet-stream')
    .set('X-Nombre-Archivo', encodeURIComponent(nombre))
    .send(archivo);

const ENCABEZADO_APRENDICES = ['Nombre completo', 'Cédula', 'Correo', 'Ficha', 'Programa (opcional)', 'Jornada (opcional)'];

beforeAll(async () => {
  await cleanDatabase();
  coordinador = await crearUsuario('Coordinador Cargas', '9400000001', 'coordinador');
  await crearUsuario('Ya Existe', '9400000099', 'aprendiz', { email: 'existe@misena.edu.co' });
});

describe('Plantillas', () => {
  it('descarga la plantilla .xlsx de cada tipo con sus encabezados', async () => {
    const res = await request(app)
      .get('/api/coordinador/cargas/plantilla/aprendices')
      .set('Authorization', `Bearer ${coordinador.token}`)
      .buffer(true)
      .parse(binario);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /spreadsheetml/);
    const filas = await leerXlsx(res.body);
    assert.deepStrictEqual(filas[0], ENCABEZADO_APRENDICES);
  });
});

describe('Vista previa: valida cada fila', () => {
  it('marca vacíos, correos inválidos, duplicados en el archivo y en el sistema, fichas inválidas y fórmulas', async () => {
    const archivo = await crearXlsx([
      ENCABEZADO_APRENDICES,
      ['Laura Rojas', '9400000010', 'laura@misena.edu.co', '2847251', 'ADSO', 'mañana'], // 2 válida
      ['', '9400000011', 'sin-nombre@misena.edu.co', '2847251', '', ''], // 3 sin nombre
      ['Pedro Pérez', '9400000012', 'correo-malo', '2847251', '', ''], // 4 correo inválido
      ['Laura Copia', '9400000010', 'otra@misena.edu.co', '2847251', '', ''], // 5 cédula repetida
      ['Ana Gómez', '9400000013', 'laura@misena.edu.co', '2847251', '', ''], // 6 correo repetido
      ['Ya Existe', '9400000099', 'nuevo@misena.edu.co', '2847251', '', ''], // 7 cédula existente: se omite
      ['Mario Ruiz', '9400000014', 'existe@misena.edu.co', '2847251', '', ''], // 8 correo existente
      ['Sofía Díaz', '9400000015', 'sofia@misena.edu.co', '12AB', '', ''], // 9 ficha inválida
      ['=HYPERLINK("http://x")', '9400000016', 'formula@misena.edu.co', '2847251', '', ''], // 10 fórmula
      ['@SUM(A1)', '9400000017', 'arroba@misena.edu.co', '2847251', '', ''], // 11 empieza con @
      ['Carlos Paz', '9400000018', 'carlos@misena.edu.co', '3000999', 'Cocina', 'Tarde'], // 12 válida, ficha nueva
    ]);
    const res = await enviar('aprendices', 'previsualizar', archivo, 'aprendices.xlsx');
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    const porFila = Object.fromEntries(res.body.filas.map((f: any) => [f.fila, f]));
    assert.strictEqual(porFila[2].estado, 'valida');
    assert.match(porFila[3].mensajes.join(' '), /Falta el nombre completo/);
    assert.match(porFila[4].mensajes.join(' '), /correo no es válido/);
    assert.match(porFila[5].mensajes.join(' '), /cédula está repetida en el archivo \(fila 2\)/);
    assert.match(porFila[6].mensajes.join(' '), /correo está repetido en el archivo \(fila 2\)/);
    assert.strictEqual(porFila[7].estado, 'omitida');
    assert.match(porFila[8].mensajes.join(' '), /correo ya está registrado/);
    assert.match(porFila[9].mensajes.join(' '), /ficha debe tener entre 5 y 12 números/);
    assert.strictEqual(porFila[10].estado, 'error');
    assert.match(porFila[10].mensajes.join(' '), /posible fórmula/);
    assert.ok(porFila[10].datos.nombre.startsWith("'="), 'la fórmula se neutraliza con un apóstrofo');
    assert.strictEqual(porFila[11].estado, 'error');
    assert.strictEqual(porFila[12].estado, 'valida');
    assert.deepStrictEqual(res.body.resumen, { total: 11, validas: 2, omitidas: 1, errores: 8 });

    // La vista previa no crea nada
    const creados = await pool.query("SELECT COUNT(*)::int AS n FROM usuarios WHERE cedula LIKE '94000000%' AND cedula <> '9400000099' AND rol = 'aprendiz';");
    assert.strictEqual(creados.rows[0].n, 0);
  });

  it('rechaza extensiones no permitidas, archivos vacíos y columnas faltantes', async () => {
    assert.strictEqual((await enviar('aprendices', 'previsualizar', Buffer.from('hola'), 'lista.txt')).status, 400);
    assert.strictEqual((await enviar('aprendices', 'previsualizar', Buffer.from('no es zip'), 'lista.xlsx')).status, 400);
    const sinFicha = await enviar('aprendices', 'previsualizar', Buffer.from('Nombre completo;Cédula;Correo\nAna;123456;a@b.co'), 'a.csv');
    assert.strictEqual(sinFicha.status, 400);
    assert.match(sinFicha.body.message, /faltan las columnas: Ficha/);
  });

  it('limita el archivo a 2.000 filas', async () => {
    const filas = ['Nombre completo;Cédula;Correo;Teléfono'];
    for (let i = 0; i < 2001; i++) filas.push(`Persona ${i};${5000000000 + i};p${i}@sena.edu.co;`);
    const res = await enviar('instructores', 'previsualizar', Buffer.from(filas.join('\n')), 'muchos.csv');
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /máximo es 2\.000/);
  });

  it('rechaza más de 5 MB', async () => {
    const res = await enviar('instructores', 'previsualizar', Buffer.alloc(5 * 1024 * 1024 + 10, 'a'), 'grande.csv');
    assert.strictEqual(res.status, 413);
  });
});

describe('Confirmar carga', () => {
  it('crea solo las filas válidas, activas, con la cédula como contraseña y cambio obligatorio', async () => {
    const csv = [
      'Nombre completo;Cédula;Correo;Teléfono (opcional)',
      'María Gómez;9400000020;mgomez@sena.edu.co;+57 300 123 4567',
      'Jorge Martínez;9400000021;jmartinez@sena.edu.co;',
      'Sin Correo;9400000022;;',
      'Ya Existe;9400000099;otro@sena.edu.co;',
    ].join('\r\n');
    const res = await enviar('instructores', 'confirmar', Buffer.from(csv, 'utf8'), 'instructores.csv');
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.deepStrictEqual(res.body.resumen, { total_filas: 4, creados: 2, omitidos: 1, con_error: 1 });

    const maria = (
      await pool.query("SELECT estado, origen, debe_cambiar_clave, password_hash, telefono, rol FROM usuarios WHERE cedula = '9400000020';")
    ).rows[0];
    assert.strictEqual(maria.estado, 'activo');
    assert.strictEqual(maria.origen, 'carga_masiva');
    assert.strictEqual(maria.debe_cambiar_clave, true);
    assert.strictEqual(maria.rol, 'instructor');
    assert.strictEqual(maria.telefono, '+57 300 123 4567');
    assert.ok(await bcrypt.compare('9400000020', maria.password_hash));
    assert.match(maria.password_hash, /^\$2[aby]\$10\$/, 'bcrypt con 10 rondas');

    // La cédula existente no se sobrescribe
    const existente = await pool.query("SELECT nombre, rol FROM usuarios WHERE cedula = '9400000099';");
    assert.deepStrictEqual(existente.rows[0], { nombre: 'Ya Existe', rol: 'aprendiz' });

    const carga = await pool.query('SELECT tipo, archivo, total_filas, creados, omitidos, con_error, coordinador_id FROM cargas_masivas;');
    assert.deepStrictEqual(carga.rows[0], {
      tipo: 'instructores',
      archivo: 'instructores.csv',
      total_filas: 4,
      creados: 2,
      omitidos: 1,
      con_error: 1,
      coordinador_id: coordinador.id,
    });
    const auditoria = await pool.query("SELECT 1 FROM auditoria WHERE accion = 'cargar' AND entidad = 'carga_masiva';");
    assert.strictEqual(auditoria.rowCount, 1);

    // Primer ingreso con la cédula: debe cambiar la contraseña
    const sesion = await request(app).post('/api/auth/login').send({ document: '9400000020', password: '9400000020' });
    assert.strictEqual(sesion.status, 200);
    assert.strictEqual(sesion.body.user.debe_cambiar_clave, true);
  });

  it('crea la ficha que no existe con el programa y la jornada del archivo', async () => {
    const archivo = await crearXlsx([
      ENCABEZADO_APRENDICES,
      ['Carlos Paz', '9400000030', 'cpaz@misena.edu.co', '3000999', 'Cocina', 'Tarde'],
    ]);
    const res = await enviar('aprendices', 'confirmar', archivo, 'aprendices.xlsx');
    assert.strictEqual(res.status, 201);
    const ficha = await pool.query("SELECT programa, jornada FROM fichas WHERE codigo_ficha = '3000999';");
    assert.deepStrictEqual(ficha.rows[0], { programa: 'Cocina', jornada: 'tarde' });
  });

  it('el resultado en Excel trae el estado de cada fila y neutraliza las fórmulas', async () => {
    const archivo = await crearXlsx([
      ENCABEZADO_APRENDICES,
      ['=1+1', '9400000040', 'f@misena.edu.co', '2847251', '', ''],
      ['Lucía Vega', '9400000041', 'lvega@misena.edu.co', '2847251', '', ''],
    ]);
    const carga = await enviar('aprendices', 'confirmar', archivo, 'con-formula.xlsx');
    assert.strictEqual(carga.status, 201);
    const res = await request(app)
      .get(`/api/coordinador/cargas/${carga.body.id}/resultado`)
      .set('Authorization', `Bearer ${coordinador.token}`)
      .buffer(true)
      .parse(binario);
    assert.strictEqual(res.status, 200);
    const filas = await leerXlsx(res.body);
    const formula = filas.find((f) => f.includes('9400000040'))!;
    assert.ok(formula[1].startsWith("'="), `se esperaba la fórmula neutralizada: ${formula[1]}`);
    assert.ok(formula.includes('error'));
    assert.ok(filas.find((f) => f.includes('9400000041'))!.includes('creado'));
  });

  it('solo el coordinador puede cargar (403 para el encargado)', async () => {
    const encargado = await crearUsuario('Encargado', '9400000002', 'encargado');
    const res = await request(app)
      .post('/api/coordinador/cargas/instructores/previsualizar')
      .set('Authorization', `Bearer ${encargado.token}`)
      .set('Content-Type', 'application/octet-stream')
      .set('X-Nombre-Archivo', 'a.csv')
      .send(Buffer.from('x'));
    assert.strictEqual(res.status, 403);
  });
});

describe('Archivos de ejemplo de database/ejemplos', () => {
  const ejemplo = (nombre: string) => readFileSync(new URL(`../../../database/ejemplos/${nombre}`, import.meta.url));

  it('los archivos válidos no tienen errores', async () => {
    const aprendices = await enviar('aprendices', 'previsualizar', ejemplo('carga-aprendices-valido.xlsx'), 'a.xlsx');
    assert.strictEqual(aprendices.status, 200, JSON.stringify(aprendices.body));
    assert.deepStrictEqual(aprendices.body.resumen, { total: 5, validas: 5, omitidas: 0, errores: 0 });
    const instructores = await enviar('instructores', 'previsualizar', ejemplo('carga-instructores-valido.xlsx'), 'i.xlsx');
    assert.deepStrictEqual(instructores.body.resumen, { total: 3, validas: 3, omitidas: 0, errores: 0 });
  });

  it('el archivo con errores marca cada caso', async () => {
    const res = await enviar('aprendices', 'previsualizar', ejemplo('carga-aprendices-con-errores.xlsx'), 'e.xlsx');
    assert.strictEqual(res.status, 200);
    // En la base de pruebas la cédula de la demo (1005678901) no existe, así que esa fila es válida
    assert.deepStrictEqual(res.body.resumen, { total: 11, validas: 2, omitidas: 0, errores: 9 });
  });
});
