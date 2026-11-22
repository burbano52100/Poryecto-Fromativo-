import { useState, type ReactNode } from 'react';
import { Alert, Card, CloseButton } from '@heroui/react';
import { Hueso } from '../atoms/Hueso';
import { CheckCircle2 } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';
import type { ReservaCreada } from '../../types/api';
import { esMenuPublicado, useMenuActivo, useReservarAlmuerzo } from '../../hooks/useMenu';
import { MenuCard } from '../molecules/MenuCard';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { fechaLarga, pesos } from '../../lib/formato';

interface ReservaAlmuerzoCardProps {
  user: User;
  note?: string;
  tituloConfirmacion: string;
  /** Contenido del modal de confirmación; recibe el precio que fijó el backend. */
  detalleConfirmacion: (precio: string) => ReactNode;
  mensajeExito: (reserva: ReservaCreada) => string;
}

/**
 * Menú del día con el flujo de reserva real (POST /api/consumos/reservar).
 * El aprendiz beneficiario reserva con un solo clic; los demás confirman en un modal.
 */
export const ReservaAlmuerzoCard = ({
  user,
  note,
  tituloConfirmacion,
  detalleConfirmacion,
  mensajeExito,
}: ReservaAlmuerzoCardProps) => {
  const { data: menu, isPending, isError, error, refetch } = useMenuActivo();
  const reservar = useReservarAlmuerzo();
  const [confirmando, setConfirmando] = useState(false);
  const [reservaHecha, setReservaHecha] = useState<ReservaCreada | null>(null);

  if (isPending) {
    return (
      <Card
        role="status"
        aria-label="Cargando el menú del día..."
        className="skeleton--shimmer relative overflow-hidden p-0 md:flex-row"
      >
        <Hueso className="h-48 w-full rounded-none md:h-auto md:w-64" />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <Hueso className="h-5 w-20 rounded-full" />
          <Hueso className="h-6 w-2/3 rounded-md" />
          <Hueso className="h-4 w-1/3 rounded-md" />
          <Hueso className="mt-4 h-4 w-full rounded-md" />
          <Hueso className="h-4 w-4/5 rounded-md" />
          <div className="mt-6 flex items-end justify-between">
            <Hueso className="h-8 w-28 rounded-md" />
            <Hueso className="h-11 w-44 rounded-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (isError) {
    return <ErrorAlert error={error} titulo="No se pudo cargar el menú del día" onReintentar={() => refetch()} />;
  }

  const esBeneficiario = user.role === 'aprendiz' && menu.es_beneficiario;
  const precio = pesos(menu.precio_aplicable);
  const hayCupo = menu.cantidad_disponible - menu.cantidad_vendida > 0;

  const ejecutarReserva = () =>
    reservar.mutate(esMenuPublicado(menu) ? menu.id : undefined, {
      onSuccess: (reserva) => {
        setReservaHecha(reserva);
        setConfirmando(false);
      },
      onError: () => setConfirmando(false),
    });

  const solicitar = () => {
    reservar.reset();
    setReservaHecha(null);
    if (esBeneficiario) ejecutarReserva();
    else setConfirmando(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {reservaHecha && (
        <Alert status="success" role="status">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Almuerzo reservado</Alert.Title>
            <Alert.Description>{mensajeExito(reservaHecha)}</Alert.Description>
          </Alert.Content>
          <CloseButton aria-label="Cerrar aviso" onPress={() => setReservaHecha(null)} />
        </Alert>
      )}

      {reservar.isError && (
        <ErrorAlert error={reservar.error} titulo="No se pudo reservar el almuerzo" onCerrar={() => reservar.reset()} />
      )}

      <MenuCard
        dateText={fechaLarga(new Date(`${menu.fecha}T12:00:00-05:00`))}
        title={menu.nombre}
        description={menu.descripcion}
        price={precio}
        note={note}
        imageUrl={menu.imagen_url}
        isAvailable={hayCupo}
        canReserve={menu.reservable}
        unavailableReason={menu.motivo_no_reservable}
        reservation={menu.mi_reserva}
        onRequestLunch={solicitar}
        isLoading={reservar.isPending && !confirmando}
        isBeneficiario={esBeneficiario}
      />

      <ConfirmDialog
        abierto={confirmando}
        titulo={tituloConfirmacion}
        icono={<CheckCircle2 className="size-5" />}
        textoConfirmar={`Confirmar (${precio})`}
        onConfirmar={ejecutarReserva}
        onCancelar={() => setConfirmando(false)}
        cargando={reservar.isPending}
      >
        {detalleConfirmacion(precio)}
      </ConfirmDialog>
    </div>
  );
};
