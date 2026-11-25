import { Chip } from '@heroui/react';
import { CheckCircle2, Clock } from 'lucide-react';
import { EstadoPagoBadge } from '../atoms/EstadoPagoBadge';
import type { Consumo } from '../../types/api';

/**
 * Un almuerzo del historial: si sigue reservado (menú de hoy) o ya fue consumido,
 * y su estado de pago tal como lo marcó el Encargado.
 */
export const ConsumoRow = ({ consumo }: { consumo: Consumo }) => {
  const reservado = consumo.status === 'RESERVED';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            reservado ? 'bg-accent-soft text-accent-soft-foreground' : 'bg-success-soft text-success-soft-foreground'
          }`}
        >
          {reservado ? <Clock className="size-5" /> : <CheckCircle2 className="size-5" />}
        </div>

        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{consumo.title}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <span>{consumo.date}</span>
            <Chip size="sm" variant="soft" color={reservado ? 'accent' : 'default'}>
              {reservado ? 'Reservado' : 'Consumido'}
            </Chip>
            {consumo.fiado && (
              <Chip size="sm" variant="soft" color="warning">
                Fiado
              </Chip>
            )}
            {consumo.estado_pago === 'pendiente' && consumo.comprobante_estado === 'en_revision' && (
              <Chip size="sm" variant="soft" color="warning">
                Comprobante en revisión
              </Chip>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <p className="font-semibold tabular-nums text-foreground">{consumo.price}</p>
        <EstadoPagoBadge estado={consumo.estado_pago} />
      </div>
    </div>
  );
};
