import { Receipt } from 'lucide-react';
import { Badge } from '../atoms/Badge';
import { LoadingSpinner } from '../atoms/LoadingSpinner';
import { ConsumoRow } from '../molecules/ConsumoRow';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { useConsumos } from '../../hooks/useConsumos';

/** Mis Fichas / Consumos del aprendiz: cada reserva con su estado y si ya está pagada. */
export const MisFichasSection = () => {
  const { data: consumos = [], isPending, isError, error, refetch } = useConsumos();

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-green-600" />
            Mis Fichas y Consumos
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">
            Tus reservas de almuerzo y su estado de pago
          </p>
        </div>

        <Badge variant="green" className="text-sm py-1.5 px-3.5 font-extrabold">
          {consumos.length} fichas
        </Badge>
      </div>

      {isPending ? (
        <LoadingSpinner label="Cargando tus fichas..." />
      ) : isError ? (
        <ErrorAlert error={error} titulo="No se pudo cargar tu historial" onReintentar={() => refetch()} />
      ) : consumos.length === 0 ? (
        <p className="py-12 text-center text-gray-400 text-sm">
          Aún no has reservado almuerzos. Hazlo desde Inicio.
        </p>
      ) : (
        <div className="space-y-3">
          {consumos.map((consumo) => (
            <ConsumoRow key={consumo.id} consumo={consumo} />
          ))}
        </div>
      )}
    </div>
  );
};
