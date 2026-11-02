/** $5.000 (pesos colombianos sin decimales). */
export const pesos = (valor: number): string => `$${Math.round(valor).toLocaleString('es-CO')}`;

/** "lunes, 2 de noviembre de 2026" con la primera letra en mayúscula. */
export const fechaLarga = (fecha: Date = new Date()): string => {
  const texto = fecha.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Fecha y hora cortas en hora de Colombia: "2/11/2026, 12:30 p. m." */
export const fechaHora = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });

/** Fecha de hoy en Colombia como YYYY-MM-DD (para inputs type="date"). */
export const hoyBogota = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
