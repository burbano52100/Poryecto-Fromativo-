import os from 'node:os';
import path from 'node:path';
import { createWorker, type Worker } from 'tesseract.js';

/**
 * Lector de comprobantes de pago con QR (ADR 027).
 *
 * Tesseract (OCR gratuito, ya entrenado para español) convierte la captura en texto y las funciones
 * de este archivo sacan de ese texto el banco, el valor, la fecha, la hora, el número del
 * comprobante y si el pago fue para el Centro de Gestión. No confirma que el dinero llegó: solo
 * revisa que el comprobante se vea válido, sea de hoy, por el valor del almuerzo y a la hora de la
 * reserva. Lo que no se puede leer con seguridad se manda a revisión del encargado en vez de adivinar.
 */

// ---------------------------------------------------------------- OCR

export interface LecturaOcr {
  texto: string;
  /** Confianza promedio de Tesseract, de 0 a 100. */
  confianza: number;
}

type Lector = (imagen: Buffer) => Promise<LecturaOcr>;

let worker: Promise<Worker> | null = null;

const obtenerWorker = (): Promise<Worker> => {
  // Un solo worker para todo el proceso: crearlo tarda ~1 s y descarga una vez el idioma español
  worker ??= createWorker('spa', 1, { cachePath: path.join(os.tmpdir(), 'sara-tessdata') }).catch((error) => {
    worker = null;
    throw error;
  });
  return worker;
};

const lectorTesseract: Lector = async (imagen) => {
  const w = await obtenerWorker();
  const { data } = await w.recognize(imagen);
  return { texto: data.text ?? '', confianza: Number(data.confidence ?? 0) };
};

let lectorActual: Lector = lectorTesseract;
let cola: Promise<unknown> = Promise.resolve();

/** Lee la imagen con OCR. Las lecturas van en fila: un worker atiende una imagen a la vez. */
export const leerImagen = (imagen: Buffer): Promise<LecturaOcr> => {
  const tarea = cola.then(() => lectorActual(imagen));
  cola = tarea.catch(() => undefined);
  return tarea;
};

/** Solo para pruebas: reemplaza el OCR por una función (null vuelve a Tesseract). */
export const usarLectorDePrueba = (lector: Lector | null): void => {
  lectorActual = lector ?? lectorTesseract;
};

export const cerrarLector = async (): Promise<void> => {
  const actual = worker;
  worker = null;
  if (actual) await (await actual).terminate();
};

/** Tipo de imagen según sus primeros bytes. Solo se aceptan PNG, JPEG y WEBP. */
export const tipoDeImagen = (imagen: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null => {
  if (imagen.length < 12) return null;
  if (imagen[0] === 0x89 && imagen.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (imagen[0] === 0xff && imagen[1] === 0xd8 && imagen[2] === 0xff) return 'image/jpeg';
  if (imagen.toString('ascii', 0, 4) === 'RIFF' && imagen.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
};

// ---------------------------------------------------------------- Análisis del texto

export interface AnalisisComprobante {
  banco: string | null;
  numero: string | null;
  /** Valores del pago encontrados (sin saldos, costos ni comisiones). */
  valores: number[];
  /** Fechas encontradas, 'YYYY-MM-DD'. */
  fechas: string[];
  /** Hora del pago, 'HH:MM' en 24 horas. */
  hora: string | null;
  /** El texto nombra al destinatario del QR (Centro de Gestión Surcolombiano). */
  destinatario: boolean;
}

/** Mayúsculas y sin tildes, para comparar sin importar cómo lo escriba cada banco. */
export const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// El banco que envía va primero: Nequi y Daviplata pueden nombrar a Bancolombia como destino
const BANCOS: [RegExp, string][] = [
  [/\bNEQUI\b/, 'Nequi'],
  [/\bDAVI\s?PLATA\b/, 'Daviplata'],
  [/\bDAVIVIENDA\b/, 'Davivienda'],
  [/\bBBVA\b/, 'BBVA'],
  [/\bBANCO DE BOGOTA\b/, 'Banco de Bogotá'],
  [/\bBANCO DE OCCIDENTE\b/, 'Banco de Occidente'],
  [/\bBANCO POPULAR\b/, 'Banco Popular'],
  [/\bAV\s?VILLAS\b/, 'Banco AV Villas'],
  [/\bCAJA SOCIAL\b/, 'Banco Caja Social'],
  [/\bSCOTIABANK\b|\bCOLPATRIA\b/, 'Scotiabank Colpatria'],
  [/\bITAU\b/, 'Itaú'],
  [/\bBANCO AGRARIO\b/, 'Banco Agrario'],
  [/\bLULO\b/, 'Lulo Bank'],
  [/\bNU\s?COLOMBIA\b|\bNUBANK\b/, 'Nu'],
  [/\bMOVII\b/, 'Movii'],
  [/\bRAPPI\s?PAY\b/, 'RappiPay'],
  [/\bBANCO FALABELLA\b/, 'Banco Falabella'],
  [/\bBANCOLOMBIA\b/, 'Bancolombia'],
];

const detectarBanco = (t: string): string | null => BANCOS.find(([re]) => re.test(t))?.[1] ?? null;

// soloDigitos: el número es solo dígitos, así que las letras O, I y L que lea el OCR son 0, 1 y 1
const PATRONES_NUMERO: { re: RegExp; soloDigitos: boolean }[] = [
  { re: /COMPROBANTE\s*(?:NO\.?|N[°º]\.?|NUMERO|NRO\.?|#)?[\s:.#]*([0-9OIL][0-9OIL ]{3,}[0-9OIL])/, soloDigitos: true },
  {
    re: /(?:NUMERO|NO\.?|NRO\.?|N[°º])\s*(?:DE\s*)?(?:APROBACION|AUTORIZACION|TRANSACCION|OPERACION|REFERENCIA|COMPROBANTE)[\s:.#]*([A-Z0-9]{4,})/,
    soloDigitos: false,
  },
  { re: /(?:CODIGO|ID)\s*(?:DE\s*)?(?:LA\s*)?(?:TRANSACCION|OPERACION|APROBACION|PAGO)[\s:.#]*([A-Z0-9]{4,})/, soloDigitos: false },
  { re: /REFERENCIA(?:\s*DE\s*PAGO)?[\s:.#]*([A-Z]{0,2}[0-9OIL]{5,})/, soloDigitos: false },
  { re: /\bCUS[\s:.#]*([0-9OIL]{5,})/, soloDigitos: true },
  { re: /\bAPROBACION[\s:.#]*([0-9OIL]{4,})/, soloDigitos: true },
  { re: /\bREF\.?[\s:.#]*([A-Z0-9]{5,})/, soloDigitos: false },
];

const aDigitos = (texto: string) => texto.replace(/O/g, '0').replace(/[IL]/g, '1');

/** Limpia el número: sin espacios y con las confusiones típicas del OCR corregidas en la parte numérica. */
const limpiarNumero = (crudo: string, soloDigitos: boolean): string => {
  const sinEspacios = crudo.replace(/\s+/g, '');
  if (soloDigitos) return aDigitos(sinEspacios);
  // Referencias como la de Nequi (M8392017): una o dos letras y luego dígitos
  const prefijo = sinEspacios.match(/^[A-Z]{1,2}(?=[0-9])/)?.[0] ?? '';
  return prefijo + aDigitos(sinEspacios.slice(prefijo.length));
};

const detectarNumero = (t: string): string | null => {
  for (const { re, soloDigitos } of PATRONES_NUMERO) {
    const m = t.match(re);
    if (m?.[1]) {
      const numero = limpiarNumero(m[1], soloDigitos);
      if (/[0-9]{4,}/.test(numero)) return numero;
    }
  }
  return null;
};

const MESES: Record<string, number> = {
  ENERO: 1, ENE: 1, JAN: 1,
  FEBRERO: 2, FEB: 2,
  MARZO: 3, MAR: 3,
  ABRIL: 4, ABR: 4, APR: 4,
  MAYO: 5, MAY: 5,
  JUNIO: 6, JUN: 6,
  JULIO: 7, JUL: 7,
  AGOSTO: 8, AGO: 8, AUG: 8,
  SEPTIEMBRE: 9, SETIEMBRE: 9, SEPT: 9, SEP: 9,
  OCTUBRE: 10, OCT: 10,
  NOVIEMBRE: 11, NOV: 11,
  DICIEMBRE: 12, DIC: 12, DEC: 12,
};
const MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|');

const armarFecha = (anio: number, mes: number, dia: number): string | null => {
  const a = anio < 100 ? 2000 + anio : anio;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || a < 2000 || a > 2100) return null;
  const d = new Date(Date.UTC(a, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

const detectarFechas = (t: string, hoy: string): string[] => {
  const fechas = new Set<string>();
  const agregar = (f: string | null) => f && fechas.add(f);
  // 25 nov. 2026 | 25 de noviembre de 2026 | 25-nov-2026
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})\\s*(?:DE\\s+)?[-/]?\\s*(${MES})\\.?\\s*(?:DE\\s+|DEL\\s+)?[-/,]?\\s*(\\d{4}|\\d{2})\\b`, 'g'))) {
    agregar(armarFecha(Number(m[3]), MESES[m[2]], Number(m[1])));
  }
  // nov 25, 2026 | noviembre 25 de 2026
  for (const m of t.matchAll(new RegExp(`\\b(${MES})\\.?\\s+(\\d{1,2}),?\\s*(?:DE\\s+)?(\\d{4})\\b`, 'g'))) {
    agregar(armarFecha(Number(m[3]), MESES[m[1]], Number(m[2])));
  }
  // 2026-11-25 | 2026/11/25
  for (const m of t.matchAll(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/g)) {
    agregar(armarFecha(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  // 25/11/2026 | 25-11-26 (en Colombia el día va primero)
  for (const m of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) {
    agregar(armarFecha(Number(m[3]), Number(m[2]), Number(m[1])) ?? armarFecha(Number(m[3]), Number(m[1]), Number(m[2])));
  }
  // "Hoy, 12:31 p. m." en apps que no escriben la fecha
  if (fechas.size === 0 && /\bHOY\b[\s,.-]*\d{1,2}:\d{2}/.test(t)) fechas.add(hoy);
  return [...fechas];
};

const RE_HORA = /\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?!\d)\s*(A\.?\s?M\b\.?|P\.?\s?M\b\.?)?/;
const RE_LINEA_CON_FECHA = new RegExp(`\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{4}[/.-]\\d{1,2}[/.-]\\d{1,2}|\\b(?:${MES})\\b|\\bHOY\\b`);

const detectarHora = (t: string): string | null => {
  // Primero la hora que va junto a la fecha del pago: la del reloj del celular, arriba en la captura, no cuenta
  const lineas = t.split(/\r?\n/);
  const enLineaConFecha = lineas.find((l) => RE_LINEA_CON_FECHA.test(l) && RE_HORA.test(l));
  const m = (enLineaConFecha ?? t).match(RE_HORA);
  if (!m) return null;
  let hora = Number(m[1]);
  const meridiano = m[3]?.replace(/[\s.]/g, '');
  if (meridiano === 'PM' && hora < 12) hora += 12;
  if (meridiano === 'AM' && hora === 12) hora = 0;
  return `${String(hora).padStart(2, '0')}:${m[2]}`;
};

const POSITIVAS = /VALOR|CUANTO|MONTO|TOTAL|IMPORTE|PAGASTE|ENVIASTE|TRANSFERISTE|PAGO\b/;
const NEGATIVAS = /DISPONIBLE|SALDO|COSTO|COMISION|CUOTA|GMF|4\s?X\s?1000|IVA\b|CASHBACK|PUNTOS|TOPE|LIMITE/;

/** "5.000,00" -> 5000; "10,000.00" -> 10000; "5000" -> 5000. Los centavos no cuentan en pesos. */
const aPesos = (crudo: string): number => Number(crudo.replace(/[.,]\d{1,2}$/, '').replace(/[., ]/g, ''));

const detectarValores = (texto: string): number[] => {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const principales: number[] = [];
  const neutros: number[] = [];
  lineas.forEach((linea, i) => {
    const montos = [
      ...linea.matchAll(/\$\s*(\d{1,3}(?:[., ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)/g),
      ...(linea.includes('$') ? [] : linea.matchAll(/(?:VALOR|MONTO|TOTAL|CUANTO)[^\d]{0,20}(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)(?!\d)/g)),
    ];
    for (const m of montos) {
      const valor = aPesos(m[1]);
      if (!valor) continue;
      // La etiqueta va en la misma línea antes del valor o, si allí no hay texto, en la línea anterior
      // (Nequi pone "¿Cuánto?" arriba del valor)
      const antes = linea.slice(0, m.index);
      const contexto = /[A-Z]{3,}/.test(antes) ? antes : `${lineas[i - 1] ?? ''} ${antes}`;
      if (NEGATIVAS.test(contexto)) continue;
      (POSITIVAS.test(contexto) ? principales : neutros).push(valor);
    }
  });
  return [...new Set(principales.length ? principales : neutros)];
};

/** Palabras que identifican al dueño del QR. Se pueden cambiar con DESTINATARIO_PAGO_QR (separadas por coma). */
export const palabrasDestinatario = (): string[] =>
  (process.env.DESTINATARIO_PAGO_QR || 'SURCOLOM')
    .split(',')
    .map((p) => normalizar(p.trim()))
    .filter(Boolean);

const detectarDestinatario = (t: string): boolean => {
  // El OCR a veces lee la O como 0 o la I como 1 en los nombres
  const letras = t.replace(/0/g, 'O').replace(/1/g, 'I');
  return palabrasDestinatario().some((p) => t.includes(p) || letras.includes(p));
};

export const analizarComprobante = (texto: string, hoy: string): AnalisisComprobante => {
  const t = normalizar(texto);
  return {
    banco: detectarBanco(t),
    numero: detectarNumero(t),
    valores: detectarValores(t),
    fechas: detectarFechas(t, hoy),
    hora: detectarHora(t),
    destinatario: detectarDestinatario(t),
  };
};

// ---------------------------------------------------------------- Decisión

export type EstadoComprobante = 'aceptado' | 'rechazado' | 'en_revision';

export interface Decision {
  estado: EstadoComprobante;
  motivo: string;
  /** Lo que se guarda como valor y fecha del comprobante. */
  valor: number | null;
  fecha: string | null;
}

export interface ContextoDecision {
  hoy: string;
  valorEsperado: number;
  confianza: number;
  /** Cuándo se hizo la reserva y la hora actual, con el reloj de la base de datos. */
  reservaEn: Date;
  ahora: Date;
}

export const CONFIANZA_MINIMA = 60;
const MARGEN_ANTES_DE_RESERVA_MIN = 60;
const MARGEN_FUTURO_MIN = 10;

const pesos = (v: number) => `$${v.toLocaleString('es-CO')}`;
const fechaLegible = (f: string) =>
  new Date(`${f}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const horaLegible = (h: string) => {
  const [hh, mm] = h.split(':').map(Number);
  const sufijo = hh < 12 ? 'a. m.' : 'p. m.';
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, '0')} ${sufijo}`;
};
const lista = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;

/** Instante de una fecha y hora de Colombia (UTC-5 todo el año). */
const instanteBogota = (fecha: string, hora: string): Date => new Date(`${fecha}T${hora}:00-05:00`);

export const decidir = (a: AnalisisComprobante, ctx: ContextoDecision): Decision => {
  const { hoy, valorEsperado } = ctx;
  const fecha = a.fechas.includes(hoy) ? hoy : (a.fechas[0] ?? null);
  const valor = a.valores.includes(valorEsperado) ? valorEsperado : (a.valores[0] ?? null);
  const base = { valor, fecha };

  if (!a.fechas.length && !a.valores.length && !a.numero) {
    return {
      ...base,
      estado: 'rechazado',
      motivo: 'No encontré los datos de un pago en la imagen. Sube la captura de pantalla del comprobante que te muestra la app de tu banco.',
    };
  }
  if (fecha && fecha !== hoy) {
    return { ...base, estado: 'rechazado', motivo: `El comprobante es del ${fechaLegible(fecha)}. Solo se aceptan pagos hechos hoy.` };
  }
  if (valor !== null && valor !== valorEsperado) {
    return {
      ...base,
      estado: 'rechazado',
      motivo: `El comprobante es por ${pesos(valor)} y tu almuerzo cuesta ${pesos(valorEsperado)}.`,
    };
  }
  if (fecha === hoy && a.hora) {
    const pago = instanteBogota(hoy, a.hora).getTime();
    if (pago < ctx.reservaEn.getTime() - MARGEN_ANTES_DE_RESERVA_MIN * 60_000) {
      return {
        ...base,
        estado: 'rechazado',
        motivo: `El pago se hizo a las ${horaLegible(a.hora)}, más de una hora antes de tu reserva. Sube el comprobante del pago de este almuerzo.`,
      };
    }
    if (pago > ctx.ahora.getTime() + MARGEN_FUTURO_MIN * 60_000) {
      return {
        ...base,
        estado: 'en_revision',
        motivo: `La hora del comprobante (${horaLegible(a.hora)}) es posterior a la hora actual. El encargado lo revisará.`,
      };
    }
  }

  const faltantes: string[] = [];
  if (!a.banco) faltantes.push('el banco');
  if (valor === null) faltantes.push('el valor');
  if (!fecha) faltantes.push('la fecha');
  if (!a.hora) faltantes.push('la hora');
  if (!a.numero) faltantes.push('el número del comprobante');
  if (!a.destinatario) faltantes.push('que el pago fue para el Centro de Gestión');
  if (ctx.confianza < CONFIANZA_MINIMA) faltantes.push('una imagen nítida');
  if (faltantes.length) {
    return {
      ...base,
      estado: 'en_revision',
      motivo: `No pude confirmar ${lista(faltantes)}. El encargado revisará tu comprobante y tu almuerzo sigue apartado.`,
    };
  }

  return {
    ...base,
    estado: 'aceptado',
    motivo: `Pago de ${a.banco} por ${pesos(valorEsperado)} hoy a las ${horaLegible(a.hora!)}, comprobante ${a.numero}.`,
  };
};
