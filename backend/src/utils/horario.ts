/**
 * Horario de reservas de almuerzo: 7:00 a. m. a 9:00 p. m., hora de Colombia.
 * Se calcula con el reloj del servidor (Date) para poder fijarlo en los tests.
 */
export const ZONA_HORARIA = 'America/Bogota';

export const HORARIO_RESERVA = { abre: '07:00', cierra: '21:00' } as const;

const APERTURA_MIN = 7 * 60;
const CIERRE_MIN = 21 * 60;

export const MENSAJE_FUERA_DE_HORARIO =
  'Las reservas de almuerzo solo se reciben de 7:00 a. m. a 9:00 p. m. (hora de Colombia).';

const minutosEnBogota = (fecha: Date): number => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return valor('hour') * 60 + valor('minute');
};

/** Fecha en Colombia como 'YYYY-MM-DD'. `toISOString()` daría la fecha UTC, que después de las 7 p. m. ya es mañana. */
export const fechaBogota = (fecha: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);

/** Colombia está en UTC-5 todo el año (no tiene horario de verano). */
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

/** true si el texto es 'YYYY-MM-DD' y esa fecha existe en el calendario (rechaza 2026-02-30). */
export const esFechaValida = (valor: string): boolean => {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
};

/**
 * 'YYYY-MM-DDTHH:mm' leído como hora de Colombia (el valor de un <input type="datetime-local">)
 * → el instante correspondiente. null si no es una fecha y hora real.
 */
export const instanteEnBogota = (valor: string): Date | null => {
  const partes = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(valor);
  if (!partes || !esFechaValida(partes[1])) return null;
  const [anio, mes, dia] = partes[1].split('-').map(Number);
  const hora = Number(partes[2]);
  const minuto = Number(partes[3]);
  if (hora > 23 || minuto > 59) return null;
  return new Date(Date.UTC(anio, mes - 1, dia, hora, minuto) + OFFSET_BOGOTA_MS);
};

export const reservasAbiertas = (ahora: Date = new Date()): boolean => {
  const minutos = minutosEnBogota(ahora);
  return minutos >= APERTURA_MIN && minutos < CIERRE_MIN;
};

export const estadoHorario = (ahora: Date = new Date()) => ({
  ...HORARIO_RESERVA,
  abierto: reservasAbiertas(ahora),
});

/** 'YYYY-MM-DD' → 'DD/MM/YYYY'. */
export const fechaLegible = (fecha: string): string => {
  const [anio, mes, dia] = fecha.split('-');
  return dia ? `${dia}/${mes}/${anio}` : fecha;
};

/**
 * true si la fecha 'YYYY-MM-DD' es anterior a hoy en Colombia. Compara solo fechas, sin hora:
 * a las 11:30 p. m. de Bogotá (ya es el día siguiente en UTC) "hoy" sigue siendo el día de Bogotá.
 */
export const esFechaAnteriorAHoy = (fecha: string, ahora: Date = new Date()): boolean => fecha < fechaBogota(ahora);
