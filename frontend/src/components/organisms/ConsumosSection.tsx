import { HistorialConsumos } from './MisFichasSection';

/** Historial de consumos del instructor, con el estado de pago de cada almuerzo, por meses. */
export const ConsumosSection = () => (
  <HistorialConsumos
    titulo="Historial de consumos"
    descripcion="Almuerzos registrados en el comedor y su estado de pago, mes a mes"
    vacio="Aún no tienes almuerzos registrados."
  />
);
