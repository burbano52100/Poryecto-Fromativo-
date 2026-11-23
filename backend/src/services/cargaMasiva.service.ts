import ExcelJS from 'exceljs';
import { z } from 'zod';
import { pool } from '../db/index.js';
import type { AuthenticatedUser } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { agregarHoja, empiezaComoFormula, libroABuffer, neutralizarCelda } from '../utils/excel.js';
import { registrarAuditoria } from './auditoria.service.js';
import { buscarOCrearFicha, hashClaveInicial, JORNADAS, type Jornada } from './cuentas.service.js';
import { withTransaction } from './inventario.service.js';

/**
 * Carga masiva de instructores y aprendices desde .xlsx o .csv (ADR 018).
 * Paso 1: vista previa que valida cada fila. Paso 2: confirmar crea solo las filas válidas,
 * activas, con la cédula como contraseña inicial y cambio obligatorio. Las cédulas que ya
 * existen se omiten (no se sobrescriben).
 */
export const LIMITE_BYTES = 5 * 1024 * 1024;
export const LIMITE_FILAS = 2000;

export const TIPOS_CARGA = ['instructores', 'aprendices'] as const;
export type TipoCarga = (typeof TIPOS_CARGA)[number];

type Clave = 'nombre' | 'cedula' | 'correo' | 'telefono' | 'ficha' | 'programa' | 'jornada';

interface DefColumna {
  clave: Clave;
  encabezado: string;
  alias: string[];
  requerida: boolean;
}

const NOMBRE: DefColumna = { clave: 'nombre', encabezado: 'Nombre completo', alias: ['nombre completo', 'nombre', 'nombres y apellidos'], requerida: true };
const CEDULA: DefColumna = { clave: 'cedula', encabezado: 'Cédula', alias: ['cedula', 'documento', 'numero de documento', 'cc'], requerida: true };
const CORREO: DefColumna = { clave: 'correo', encabezado: 'Correo', alias: ['correo', 'correo electronico', 'email', 'e-mail'], requerida: true };

export const COLUMNAS: Record<TipoCarga, DefColumna[]> = {
  instructores: [
    NOMBRE,
    CEDULA,
    CORREO,
    { clave: 'telefono', encabezado: 'Teléfono (opcional)', alias: ['telefono', 'celular'], requerida: false },
  ],
  aprendices: [
    NOMBRE,
    CEDULA,
    CORREO,
    { clave: 'ficha', encabezado: 'Ficha', alias: ['ficha', 'ficha id', 'id ficha', 'numero de ficha', 'codigo de ficha'], requerida: true },
    { clave: 'programa', encabezado: 'Programa (opcional)', alias: ['programa', 'programa de formacion'], requerida: false },
    { clave: 'jornada', encabezado: 'Jornada (opcional)', alias: ['jornada'], requerida: false },
  ],
};

const EJEMPLOS: Record<TipoCarga, Record<string, string>[]> = {
  instructores: [
    { nombre: 'María Fernanda Gómez', cedula: '1098765432', correo: 'mgomez@sena.edu.co', telefono: '3001234567' },
    { nombre: 'Jorge Eduardo Martínez', cedula: '1085432190', correo: 'jmartinez@sena.edu.co', telefono: '' },
  ],
  aprendices: [
    { nombre: 'Laura Sofía Rojas', cedula: '1005678902', correo: 'lrojas@soy.sena.edu.co', ficha: '2847251', programa: 'Análisis y Desarrollo de Software', jornada: 'mañana' },
    { nombre: 'Andrés Felipe Cruz', cedula: '1005678903', correo: 'acruz@soy.sena.edu.co', ficha: '2847251', programa: '', jornada: '' },
  ],
};

/** 'Cédula (opcional)' → 'cedula' para reconocer los encabezados sin importar tildes ni mayúsculas. */
const normalizarEncabezado = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(opcional\)/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface FilaLeida {
  /** Número de la fila en el archivo (la del encabezado es la primera con datos). */
  numero: number;
  valores: Partial<Record<Clave, string>>;
}

// ---------------------------------------------------------------- Lectura segura

const parsearCsv = (texto: string): string[][] => {
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? '';
  const delimitador = [';', ',', '\t'].reduce((mejor, d) =>
    primeraLinea.split(d).length > primeraLinea.split(mejor).length ? d : mejor
  );
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') {
        enComillas = false;
      } else {
        celda += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === delimitador) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else {
      celda += c;
    }
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
};

const decodificarTexto = (buffer: Buffer): string => {
  if (buffer.includes(0)) throw new AppError('El archivo .csv no es un archivo de texto válido.', 400);
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    texto = new TextDecoder('latin1').decode(buffer); // CSV guardado por Excel en Windows
  }
  return texto.replace(/^﻿/, '');
};

const leerXlsx = async (buffer: Buffer): Promise<string[][]> => {
  // Un .xlsx es un ZIP: debe empezar con "PK\x03\x04"
  if (buffer.length < 4 || buffer.readUInt32BE(0) !== 0x504b0304) {
    throw new AppError('El archivo no es un Excel (.xlsx) válido.', 400);
  }
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new AppError('No se pudo leer el archivo de Excel. Verifica que no esté dañado ni protegido.', 400);
  }
  const hoja = libro.worksheets[0];
  if (!hoja) throw new AppError('El archivo de Excel no tiene hojas.', 400);
  const filas: string[][] = [];
  hoja.eachRow({ includeEmpty: true }, (row, numero) => {
    const valores: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      // Una celda con fórmula se lee como "=fórmula" para que la validación la detecte
      valores[col - 1] = cell.type === ExcelJS.ValueType.Formula ? `=${cell.formula}` : cell.text ?? '';
    });
    filas[numero - 1] = Array.from(valores, (v) => v ?? '');
  });
  return Array.from(filas, (f) => f ?? []);
};

/**
 * Valida extensión, tipo, tamaño y número de filas, y devuelve las filas con los valores recortados.
 * Las columnas se reconocen por su encabezado (sin importar tildes, mayúsculas ni el orden).
 */
export async function leerArchivo(tipo: TipoCarga, buffer: Buffer, nombreArchivo: string): Promise<FilaLeida[]> {
  const extension = nombreArchivo.toLowerCase().match(/\.(xlsx|csv)$/)?.[1];
  if (!extension) throw new AppError('Solo se aceptan archivos .xlsx o .csv.', 400);
  if (!buffer || buffer.length === 0) throw new AppError('El archivo está vacío.', 400);
  if (buffer.length > LIMITE_BYTES) throw new AppError('El archivo supera el máximo de 5 MB.', 413);

  const filas = extension === 'xlsx' ? await leerXlsx(buffer) : parsearCsv(decodificarTexto(buffer));
  const indiceEncabezado = filas.findIndex((f) => f.some((v) => v.trim() !== ''));
  if (indiceEncabezado === -1) throw new AppError('El archivo no tiene datos.', 400);

  const encabezados = filas[indiceEncabezado].map((v) => normalizarEncabezado(v));
  const posiciones = new Map<Clave, number>();
  for (const columna of COLUMNAS[tipo]) {
    const indice = encabezados.findIndex((e) => columna.alias.includes(e));
    if (indice >= 0) posiciones.set(columna.clave, indice);
  }
  const faltantes = COLUMNAS[tipo].filter((c) => c.requerida && !posiciones.has(c.clave)).map((c) => c.encabezado);
  if (faltantes.length > 0) {
    throw new AppError(`Al archivo le faltan las columnas: ${faltantes.join(', ')}. Descarga la plantilla para ver el formato.`, 400);
  }

  const datos: FilaLeida[] = [];
  for (let i = indiceEncabezado + 1; i < filas.length; i++) {
    const fila = filas[i];
    if (!fila.some((v) => (v ?? '').trim() !== '')) continue;
    const valores: FilaLeida['valores'] = {};
    for (const [clave, indice] of posiciones) valores[clave] = (fila[indice] ?? '').trim();
    datos.push({ numero: i + 1, valores });
  }
  if (datos.length === 0) throw new AppError('El archivo no tiene filas con datos debajo del encabezado.', 400);
  if (datos.length > LIMITE_FILAS) {
    throw new AppError(`El archivo tiene ${datos.length} filas: el máximo es ${LIMITE_FILAS.toLocaleString('es-CO')}.`, 400);
  }
  return datos;
}

// ---------------------------------------------------------------- Validación

export type EstadoFila = 'valida' | 'omitida' | 'error';

export interface ResultadoFila {
  fila: number;
  datos: Partial<Record<Clave, string>>;
  estado: EstadoFila;
  mensajes: string[];
}

const correoSchema = z.string().email();
const NOMBRE_VALIDO = /^[\p{L}][\p{L}\s'.-]{2,149}$/u;
const TEXTO_LIBRE = /^[\p{L}\p{N}\s'.,()&/-]{1,150}$/u;

const normalizarJornada = (valor: string): Jornada | null => {
  const limpio = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const encontrada = JORNADAS.find((j) => j.normalize('NFD').replace(/[̀-ͯ]/g, '') === limpio);
  return encontrada ?? null;
};

const ETIQUETA: Record<Clave, string> = {
  nombre: 'el nombre completo',
  cedula: 'la cédula',
  correo: 'el correo',
  telefono: 'el teléfono',
  ficha: 'la ficha',
  programa: 'el programa',
  jornada: 'la jornada',
};

/** Valida el formato de cada fila, los duplicados dentro del archivo y contra el sistema. */
export async function validarFilas(tipo: TipoCarga, filas: FilaLeida[]): Promise<ResultadoFila[]> {
  const resultados: ResultadoFila[] = filas.map(({ numero, valores }) => {
    const mensajes: string[] = [];
    const datos: ResultadoFila['datos'] = {};

    for (const columna of COLUMNAS[tipo]) {
      const valor = valores[columna.clave] ?? '';
      // Un teléfono puede empezar con "+57": solo se acepta si son dígitos
      const telefonoValido = columna.clave === 'telefono' && /^\+\d[\d\s()-]{5,18}$/.test(valor);
      if (valor && empiezaComoFormula(valor) && !telefonoValido) {
        mensajes.push(`${ETIQUETA[columna.clave]} empieza con =, +, - o @ (posible fórmula): se neutralizó y no se carga`);
        datos[columna.clave] = String(neutralizarCelda(valor));
        continue;
      }
      datos[columna.clave] = valor;
      if (!valor && columna.requerida) mensajes.push(`Falta ${ETIQUETA[columna.clave]}`);
    }

    const { nombre, cedula, correo, telefono, ficha, programa, jornada } = datos;
    if (nombre && !mensajes.some((m) => m.startsWith(ETIQUETA.nombre)) && !NOMBRE_VALIDO.test(nombre)) {
      mensajes.push('El nombre debe tener entre 3 y 150 letras (sin números ni símbolos)');
    }
    if (cedula && !/^\d{6,12}$/.test(cedula)) mensajes.push('La cédula debe tener entre 6 y 12 números');
    if (correo) {
      datos.correo = correo.toLowerCase();
      if (correo.length > 150 || !correoSchema.safeParse(datos.correo).success) mensajes.push('El correo no es válido');
    }
    if (telefono && !/^\+?[\d\s()-]{7,20}$/.test(telefono)) mensajes.push('El teléfono no es válido');
    if (tipo === 'aprendices') {
      if (ficha && !/^\d{5,12}$/.test(ficha)) mensajes.push('La ficha debe tener entre 5 y 12 números');
      if (programa && !TEXTO_LIBRE.test(programa)) mensajes.push('El programa tiene caracteres no permitidos (máximo 150)');
      if (jornada) {
        const normalizada = normalizarJornada(jornada);
        if (normalizada) datos.jornada = normalizada;
        else mensajes.push('La jornada debe ser mañana, tarde o noche');
      }
    }
    return { fila: numero, datos, estado: mensajes.length > 0 ? 'error' : 'valida', mensajes };
  });

  // Duplicados dentro del archivo: la primera aparición se conserva
  const vistas = { cedula: new Map<string, number>(), correo: new Map<string, number>() };
  for (const r of resultados) {
    for (const campo of ['cedula', 'correo'] as const) {
      const valor = r.datos[campo];
      if (!valor) continue;
      const primera = vistas[campo].get(valor);
      if (primera !== undefined) {
        r.estado = 'error';
        r.mensajes.push(campo === 'cedula' ? `La cédula está repetida en el archivo (fila ${primera})` : `El correo está repetido en el archivo (fila ${primera})`);
      } else {
        vistas[campo].set(valor, r.fila);
      }
    }
  }

  // Contra el sistema: una cédula existente se omite; un correo de otra cuenta es un error
  const cedulas = resultados.filter((r) => r.estado === 'valida').map((r) => r.datos.cedula!);
  const correos = resultados.filter((r) => r.estado === 'valida').map((r) => r.datos.correo!);
  if (cedulas.length > 0) {
    const existentes = await pool.query<{ cedula: string; email: string | null }>(
      'SELECT cedula, lower(email) AS email FROM usuarios WHERE cedula = ANY($1::text[]) OR lower(email) = ANY($2::text[]);',
      [cedulas, correos]
    );
    const cedulasExistentes = new Set(existentes.rows.map((e) => e.cedula));
    const correosExistentes = new Set(existentes.rows.map((e) => e.email));
    for (const r of resultados) {
      if (r.estado !== 'valida') continue;
      if (cedulasExistentes.has(r.datos.cedula!)) {
        r.estado = 'omitida';
        r.mensajes.push('La cédula ya está registrada en el sistema: se omite (no se sobrescribe)');
      } else if (correosExistentes.has(r.datos.correo!)) {
        r.estado = 'error';
        r.mensajes.push('El correo ya está registrado por otra cuenta');
      }
    }
  }
  return resultados;
}

export const resumir = (resultados: ResultadoFila[]) => ({
  total: resultados.length,
  validas: resultados.filter((r) => r.estado === 'valida').length,
  omitidas: resultados.filter((r) => r.estado === 'omitida').length,
  errores: resultados.filter((r) => r.estado === 'error').length,
});

// ---------------------------------------------------------------- Confirmación

export type EstadoFinal = 'creado' | 'omitido' | 'error';

export interface DetalleFila {
  fila: number;
  nombre: string;
  cedula: string;
  correo: string;
  ficha?: string;
  estado: EstadoFinal;
  mensaje: string;
}

/**
 * Crea las filas válidas como cuentas activas (origen carga_masiva, contraseña = cédula con
 * cambio obligatorio) y guarda la carga en cargas_masivas. Los hash se calculan antes de abrir
 * la transacción para no tenerla abierta mientras bcrypt trabaja.
 */
export async function confirmarCarga(
  tipo: TipoCarga,
  archivo: string,
  resultados: ResultadoFila[],
  usuario: Pick<AuthenticatedUser, 'id' | 'name' | 'role'>
) {
  const hashes = new Map<string, string>();
  for (const r of resultados) {
    if (r.estado === 'valida') hashes.set(r.datos.cedula!, await hashClaveInicial(r.datos.cedula!));
  }

  return withTransaction(async (client) => {
    const detalle: DetalleFila[] = [];
    for (const r of resultados) {
      const base = {
        fila: r.fila,
        nombre: r.datos.nombre ?? '',
        cedula: r.datos.cedula ?? '',
        correo: r.datos.correo ?? '',
        ...(tipo === 'aprendices' ? { ficha: r.datos.ficha ?? '' } : {}),
      };
      if (r.estado !== 'valida') {
        detalle.push({ ...base, estado: r.estado === 'omitida' ? 'omitido' : 'error', mensaje: r.mensajes.join('. ') });
        continue;
      }
      const fichaId =
        tipo === 'aprendices'
          ? (await buscarOCrearFicha(r.datos.ficha!, { programa: r.datos.programa, jornada: (r.datos.jornada as Jornada) || null }, client)).id
          : null;
      const insertado = await client.query(
        `INSERT INTO usuarios (nombre, cedula, email, telefono, password_hash, rol, ficha_id, estado, origen,
                               debe_cambiar_clave, aprobado_por, fecha_aprobacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo', 'carga_masiva', true, $8, NOW())
         ON CONFLICT DO NOTHING
         RETURNING id;`,
        [
          r.datos.nombre,
          r.datos.cedula,
          r.datos.correo,
          r.datos.telefono || null,
          hashes.get(r.datos.cedula!),
          tipo === 'instructores' ? 'instructor' : 'aprendiz',
          fichaId,
          usuario.id,
        ]
      );
      detalle.push(
        insertado.rows[0]
          ? { ...base, estado: 'creado', mensaje: 'Cuenta creada y activa (contraseña inicial: la cédula)' }
          : { ...base, estado: 'omitido', mensaje: 'La cédula o el correo se registraron mientras tanto: se omite' }
      );
    }

    const resumen = {
      total_filas: detalle.length,
      creados: detalle.filter((d) => d.estado === 'creado').length,
      omitidos: detalle.filter((d) => d.estado === 'omitido').length,
      con_error: detalle.filter((d) => d.estado === 'error').length,
    };
    const carga = await client.query(
      `INSERT INTO cargas_masivas (tipo, archivo, total_filas, creados, omitidos, con_error, coordinador_id, detalle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id, fecha_hora;`,
      [tipo, archivo, resumen.total_filas, resumen.creados, resumen.omitidos, resumen.con_error, usuario.id, JSON.stringify(detalle)]
    );
    await registrarAuditoria(
      { usuario, accion: 'cargar', entidad: 'carga_masiva', entidadId: carga.rows[0].id, despues: { tipo, archivo, ...resumen } },
      client
    );
    return { id: carga.rows[0].id as string, fecha_hora: new Date(carga.rows[0].fecha_hora).toISOString(), resumen, detalle };
  });
}

// ---------------------------------------------------------------- Archivos de Excel

/** Plantilla .xlsx con los encabezados, dos filas de ejemplo y una hoja de instrucciones. */
export async function plantilla(tipo: TipoCarga): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const columnas = COLUMNAS[tipo].map((c) => ({ encabezado: c.encabezado, clave: c.clave, ancho: 28 }));
  agregarHoja(libro, tipo === 'instructores' ? 'Instructores' : 'Aprendices', columnas, EJEMPLOS[tipo]);
  const instrucciones = libro.addWorksheet('Instrucciones');
  instrucciones.getColumn(1).width = 110;
  [
    `Carga masiva de ${tipo} — SARA`,
    'Llena una fila por persona en la primera hoja, desde la fila 2. Borra las filas de ejemplo.',
    'Columnas obligatorias: Nombre completo, Cédula (6 a 12 números) y Correo.' +
      (tipo === 'aprendices' ? ' También la Ficha (5 a 12 números); si no existe, se crea con el programa y la jornada.' : ''),
    tipo === 'aprendices' ? 'Jornada: mañana, tarde o noche (opcional). Programa: opcional.' : 'Teléfono: opcional.',
    'No escribas fórmulas ni empieces una celda con =, +, - o @.',
    'Las cédulas que ya existen en el sistema se omiten; no se sobrescriben.',
    'Las cuentas quedan activas y su contraseña inicial es la cédula: deberán cambiarla al ingresar por primera vez.',
    `Máximo ${LIMITE_FILAS.toLocaleString('es-CO')} filas y 5 MB. Formatos: .xlsx o .csv.`,
  ].forEach((texto, i) => {
    instrucciones.addRow([texto]).font = { bold: i === 0, size: i === 0 ? 14 : 11 };
  });
  return libroABuffer(libro);
}

/** Resultado de una carga en Excel, con el estado de cada fila. */
export async function resultadoExcel(tipo: TipoCarga, archivo: string, detalle: DetalleFila[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const columnas = [
    { encabezado: 'Fila', clave: 'fila', ancho: 8 },
    { encabezado: 'Nombre completo', clave: 'nombre', ancho: 30 },
    { encabezado: 'Cédula', clave: 'cedula', ancho: 14 },
    { encabezado: 'Correo', clave: 'correo', ancho: 30 },
    ...(tipo === 'aprendices' ? [{ encabezado: 'Ficha', clave: 'ficha', ancho: 12 }] : []),
    { encabezado: 'Estado', clave: 'estado', ancho: 12 },
    { encabezado: 'Detalle', clave: 'mensaje', ancho: 70 },
  ];
  agregarHoja(libro, 'Resultado', columnas, detalle as unknown as Record<string, unknown>[], [
    `Resultado de la carga masiva de ${tipo}`,
    `Archivo: ${archivo}`,
  ]);
  return libroABuffer(libro);
}
