import { useState } from 'react';
import { Alert, Card, CloseButton } from '@heroui/react';
import { Hueso } from '../atoms/Hueso';
import type { User } from '../../schemas/auth.schema';
import { esMenuPublicado, useMenuActivo, useReservarAlmuerzo } from '../../hooks/useMenu';
import { MenuCard } from '../molecules/MenuCard';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { PagoQrDialog, type ReservaPorPagar } from './PagoQrDialog';
import { fechaLarga, pesos } from '../../lib/formato';

interface ReservaAlmuerzoCardProps {
  user: User;
  note?: string;
  /** El instructor puede fiar: reserva de una vez y se suma a su cuenta del mes (ADR 028). */
  permitirFiar?: boolean;
}

/**
 * Menú del día con el flujo de reserva real (POST /api/consumos/reservar).
 * El aprendiz beneficiario reserva gratis con un clic. Los demás pagan con el código QR (ADR 027):
 * al solicitar se aparta la porción y se abre el chat del pago para subir el comprobante. El
 * instructor también puede fiar: con un clic queda reservado y se suma a su cuenta del mes (ADR 028).
 */
export const ReservaAlmuerzoCard = ({ user, note, permitirFiar = false }: ReservaAlmuerzoCardProps) => {
  const { data: menu, isPending, isError, error, refetch } = useMenuActivo();
  const reservar = useReservarAlmuerzo();
  const [porPagar, setPorPagar] = useState<ReservaPorPagar | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [accion, setAccion] = useState<'solicitar' | 'fiar' | null>(null);

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
  const hayCupo = menu.cantidad_disponible - menu.cantidad_vendida > 0;
  const miReserva = menu.mi_reserva;

  const menuId = esMenuPublicado(menu) ? menu.id : undefined;

  const solicitar = () => {
    reservar.reset();
    setAviso(null);
    setAccion('solicitar');
    reservar.mutate(
      { menuId },
      {
        onSuccess: (reserva) => {
          if (reserva.estado_pago === 'gratis') {
            setAviso('Tarifa: $0 COP (beneficio 100 % subsidiado). Presenta tu documento o ficha en el comedor.');
          } else {
            setPorPagar({ id: reserva.id, precio: reserva.precio, vence_en: reserva.vence_en ?? null, comprobante: null });
          }
        },
        onSettled: () => setAccion(null),
      }
    );
  };

  const fiar = () => {
    reservar.reset();
    setAviso(null);
    setAccion('fiar');
    reservar.mutate(
      { menuId, formaPago: 'fiado' },
      {
        onSuccess: (reserva) =>
          setAviso(`Fiado: ${reserva.price} se sumó a tu cuenta del mes. Lo pagas a fin de mes en la oficina del comedor.`),
        onSettled: () => setAccion(null),
      }
    );
  };

  const abrirPago = () =>
    miReserva &&
    setPorPagar({
      id: miReserva.id,
      precio: miReserva.precio,
      vence_en: miReserva.vence_en ?? null,
      comprobante: miReserva.comprobante ?? null,
    });

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <Alert status="success" role="status">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Almuerzo reservado</Alert.Title>
            <Alert.Description>{aviso}</Alert.Description>
          </Alert.Content>
          <CloseButton aria-label="Cerrar aviso" onPress={() => setAviso(null)} />
        </Alert>
      )}

      {reservar.isError && (
        <ErrorAlert error={reservar.error} titulo="No se pudo reservar el almuerzo" onCerrar={() => reservar.reset()} />
      )}

      <MenuCard
        dateText={fechaLarga(new Date(`${menu.fecha}T12:00:00-05:00`))}
        title={menu.nombre}
        description={menu.descripcion}
        price={pesos(menu.precio_aplicable)}
        note={note}
        horario={`Reservas de ${menu.horario.abre} a ${menu.horario.cierra}, hora de Colombia`}
        imageUrl={menu.imagen_url}
        isAvailable={hayCupo}
        canReserve={menu.reservable}
        unavailableReason={menu.motivo_no_reservable}
        reservation={miReserva}
        onRequestLunch={solicitar}
        onPay={abrirPago}
        onCredit={permitirFiar && !esBeneficiario ? fiar : undefined}
        pending={reservar.isPending ? accion : null}
        isBeneficiario={esBeneficiario}
      />

      <PagoQrDialog reserva={porPagar} onCerrar={() => setPorPagar(null)} />
    </div>
  );
};
