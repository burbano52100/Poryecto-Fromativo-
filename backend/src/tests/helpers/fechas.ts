import { fechaBogota } from '../../utils/horario.js';
import { restarDias } from '../../utils/rango.js';

/** Fecha de Colombia ('YYYY-MM-DD') desplazada `dias` respecto a hoy (negativo = pasado). */
export const fechaRelativa = (dias: number): string => restarDias(fechaBogota(), -dias);
