import type { Consumo } from '../types/api';

export interface MesDeConsumos {
  /** "2026-11" */
  clave: string;
  /** "Noviembre de 2026" */
  nombre: string;
  consumos: Consumo[];
  total: number;
}

const nombreMes = (clave: string) => {
  const texto = new Date(`${clave}-15T12:00:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Agrupa los almuerzos por el mes del menú, del más reciente al más antiguo, con el total de cada mes. */
export const agruparPorMes = (consumos: Consumo[]): MesDeConsumos[] => {
  const meses = new Map<string, Consumo[]>();
  for (const consumo of consumos) {
    const clave = (consumo.menu_fecha || consumo.fecha).slice(0, 7);
    meses.set(clave, [...(meses.get(clave) ?? []), consumo]);
  }
  return [...meses.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([clave, lista]) => ({
      clave,
      nombre: nombreMes(clave),
      consumos: lista,
      total: lista.reduce((suma, c) => suma + c.precio, 0),
    }));
};
