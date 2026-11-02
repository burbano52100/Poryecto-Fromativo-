import { vi } from 'vitest';

const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000; // Colombia es UTC-5 todo el año

/**
 * Fija el reloj de JavaScript (solo `Date`) en la fecha de hoy de Colombia a la hora indicada.
 * PostgreSQL sigue usando su propio NOW(), así que "hoy" coincide en ambos lados.
 * Llamarla antes de firmar tokens, para que su `iat`/`exp` usen el mismo reloj.
 */
export const fijarHoraBogota = (hora: number, minuto = 0): void => {
  vi.useRealTimers();
  const hoyBogota = new Date(Date.now() - OFFSET_BOGOTA_MS);
  const objetivo = Date.UTC(
    hoyBogota.getUTCFullYear(),
    hoyBogota.getUTCMonth(),
    hoyBogota.getUTCDate(),
    hora,
    minuto
  ) + OFFSET_BOGOTA_MS;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(objetivo);
};

export const restaurarReloj = (): void => {
  vi.useRealTimers();
};
