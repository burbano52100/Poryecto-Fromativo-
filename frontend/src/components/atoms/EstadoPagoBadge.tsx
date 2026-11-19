import { Chip } from '@heroui/react';
import { CheckCircle2, Clock, Award } from 'lucide-react';
import type { EstadoPago } from '../../types/api';

const ESTADOS: Record<EstadoPago, { color: 'success' | 'warning' | 'danger'; Icono: typeof Clock; texto: string }> = {
  pagado: { color: 'success', Icono: CheckCircle2, texto: 'Pagado' },
  gratis: { color: 'warning', Icono: Award, texto: 'Gratis' },
  pendiente: { color: 'danger', Icono: Clock, texto: 'Pendiente' },
};

/** Pagado / Pendiente / Gratis (beneficiario) con el mismo color en todos los paneles. */
export const EstadoPagoBadge = ({ estado }: { estado: EstadoPago }) => {
  const { color, Icono, texto } = ESTADOS[estado] ?? ESTADOS.pendiente;
  return (
    <Chip color={color} variant="soft" size="sm">
      <Icono className="size-3.5" />
      <Chip.Label>{texto}</Chip.Label>
    </Chip>
  );
};
