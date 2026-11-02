import { useState, type ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';
import type { ReservaCreada } from '../../types/api';
import { esMenuPublicado, useMenuActivo, useReservarAlmuerzo } from '../../hooks/useMenu';
import { MenuCard } from '../molecules/MenuCard';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { LoadingSpinner } from '../atoms/LoadingSpinner';
import { fechaLarga, pesos } from '../../lib/formato';

interface ReservaAlmuerzoCardProps {
  user: User;
  ctaLabel?: string;
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
  ctaLabel,
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
      <div className="bg-white rounded-3xl border border-gray-200/80">
        <LoadingSpinner label="Cargando el menú del día..." />
      </div>
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
    <div className="space-y-4">
      {reservaHecha && (
        <div role="status" className="bg-emerald-600 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-200 shrink-0" />
            <div>
              <p className="font-extrabold text-sm sm:text-base">¡Almuerzo reservado con éxito!</p>
              <p className="text-xs text-emerald-100">{mensajeExito(reservaHecha)}</p>
            </div>
          </div>
          <button
            onClick={() => setReservaHecha(null)}
            aria-label="Cerrar aviso"
            className="p-1 hover:bg-emerald-700 rounded-lg text-emerald-200 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
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
        ctaLabel={ctaLabel}
        onRequestLunch={solicitar}
        isLoading={reservar.isPending && !confirmando}
        isBeneficiario={esBeneficiario}
      />

      <ConfirmDialog
        abierto={confirmando}
        titulo={tituloConfirmacion}
        icono={<CheckCircle2 className="w-8 h-8" />}
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
