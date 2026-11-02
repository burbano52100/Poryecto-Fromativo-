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

export const reservasAbiertas = (ahora: Date = new Date()): boolean => {
  const minutos = minutosEnBogota(ahora);
  return minutos >= APERTURA_MIN && minutos < CIERRE_MIN;
};

export const estadoHorario = (ahora: Date = new Date()) => ({
  ...HORARIO_RESERVA,
  abierto: reservasAbiertas(ahora),
});
