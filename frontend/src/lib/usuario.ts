import type { AccountType } from '../schemas/auth.schema';

/** Nombre del rol tal como se muestra en la interfaz. */
export const TITULO_ROL: Record<AccountType, string> = {
  aprendiz: 'Aprendiz SENA',
  instructor: 'Instructor SENA',
  encargado: 'Encargado del Comedor',
  coordinador: 'Coordinación Académica',
};

/** Iniciales para el avatar: primera letra del primer nombre y del primer apellido. */
export const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
