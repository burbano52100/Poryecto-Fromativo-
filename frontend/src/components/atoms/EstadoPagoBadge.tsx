import { CheckCircle2, Clock, Award } from 'lucide-react';
import { Badge } from './Badge';
import type { EstadoPago } from '../../types/api';

/** Pagado / Pendiente / Gratis (beneficiario) con el mismo color en todos los paneles. */
export const EstadoPagoBadge = ({ estado }: { estado: EstadoPago }) => {
  if (estado === 'pagado') {
    return (
      <Badge variant="green">
        <CheckCircle2 className="w-3.5 h-3.5" /> Pagado
      </Badge>
    );
  }
  if (estado === 'gratis') {
    return (
      <Badge variant="amber">
        <Award className="w-3.5 h-3.5" /> Gratis
      </Badge>
    );
  }
  return (
    <Badge variant="red">
      <Clock className="w-3.5 h-3.5" /> Pendiente
    </Badge>
  );
};
