import { Card, Chip } from '@heroui/react';
import { Award, Calendar, CheckCircle2, Clock, Info } from 'lucide-react';
import { Button } from '../atoms/Button';
import { EstadoPagoBadge } from '../atoms/EstadoPagoBadge';
import { resolverImagen } from '../../lib/assets';
import type { EstadoPago } from '../../types/api';

export interface MenuCardProps {
  dateText: string;
  title: string;
  description?: string | null;
  price: string;
  note?: string;
  /** Horario en que se reciben las reservas. */
  horario?: string;
  imageUrl?: string | null;
  /** Hay cupo en el menú. */
  isAvailable: boolean;
  /** El usuario puede reservar ahora; si no, se muestra el motivo. */
  canReserve: boolean;
  unavailableReason?: string | null;
  /** Estado de la reserva del usuario para este menú, si ya reservó. */
  reservation?: { estado_pago: EstadoPago } | null;
  onRequestLunch: () => void;
  isLoading?: boolean;
  isBeneficiario?: boolean;
}

export const MenuCard = ({
  dateText,
  title,
  description,
  price,
  note,
  horario,
  imageUrl,
  isAvailable,
  canReserve,
  unavailableReason,
  reservation,
  onRequestLunch,
  isLoading = false,
  isBeneficiario = false,
}: MenuCardProps) => (
  // Es la tarea principal del aprendiz y del instructor: borde y precio en el color del perfil
  <Card className="overflow-hidden border border-accent/30 p-0 md:flex-row">
    <img
      src={resolverImagen(imageUrl)}
      alt={title}
      className="h-48 w-full shrink-0 object-cover md:h-auto md:w-64"
      onError={(e) => {
        e.currentTarget.src = resolverImagen(null);
      }}
    />

    <div className="flex flex-1 flex-col gap-4 p-5">
      <Card.Header className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" variant="soft" color={isAvailable ? 'success' : 'danger'}>
            {isAvailable ? 'Disponible' : 'Agotado'}
          </Chip>
          {isBeneficiario && (
            <Chip size="sm" variant="soft" color="warning">
              <Award className="size-3.5" />
              <Chip.Label>Beneficiario SENA</Chip.Label>
            </Chip>
          )}
        </div>
        <Card.Title className="text-xl">{title}</Card.Title>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Calendar className="size-4" />
          {dateText}
        </p>
        {horario && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Clock className="size-4" />
            {horario}
          </p>
        )}
      </Card.Header>

      {description && (
        <Card.Content>
          <p className="text-sm leading-relaxed text-muted">{description}</p>
        </Card.Content>
      )}

      <Card.Footer className="mt-auto flex-wrap items-end justify-between gap-4 border-t border-separator pt-4">
        <div>
          <p className="text-xs text-muted">Valor del almuerzo</p>
          <p className="text-2xl font-semibold tabular-nums text-accent">
            {price}
            <span className="ml-1.5 text-xs font-normal text-muted">{isBeneficiario ? 'subsidio 100%' : 'COP'}</span>
          </p>
          {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
        </div>

        {reservation ? (
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> Almuerzo reservado
            </span>
            <EstadoPagoBadge estado={reservation.estado_pago} />
          </div>
        ) : (
          <Button size="lg" onPress={onRequestLunch} isDisabled={!canReserve || isLoading} isPending={isLoading}>
            {isBeneficiario ? 'Reservar almuerzo gratis' : 'Solicitar almuerzo'}
          </Button>
        )}
      </Card.Footer>

      {!reservation && !canReserve && unavailableReason && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Info className="size-3.5 shrink-0" />
          {unavailableReason}
        </p>
      )}
    </div>
  </Card>
);
