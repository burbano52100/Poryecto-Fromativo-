import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Receipt, Calendar, Loader2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { Badge } from '../atoms/Badge';

export interface ConsumoItem {
  id: string;
  date: string;
  title: string;
  price: string;
  paymentStatus: 'PAGADO' | 'PENDIENTE';
}

export interface ConsumosSectionProps {
  items?: ConsumoItem[];
}

export const ConsumosSection = ({ items: propItems }: ConsumosSectionProps) => {
  const { data: queryItems, isLoading, isError, error } = useQuery<ConsumoItem[]>({
    queryKey: ['consumos'],
    queryFn: async () => (await apiClient.get<ConsumoItem[]>('/consumos')).data,
    enabled: !propItems,
  });

  const consumos = propItems || queryItems || [];

  const totalConsumosCount = consumos.length;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-green-600" />
            Historial de Consumos
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">
            Registro oficial de almuerzos y estado de pago en el comedor
          </p>
        </div>

        <Badge variant="blue" className="text-sm py-1.5 px-3.5 font-extrabold">
          {totalConsumosCount} consumos
        </Badge>
      </div>

      {isLoading && (
        <div className="py-12 flex justify-center items-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando historial de consumos...</span>
        </div>
      )}

      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <span>Error al consultar consumos: {error instanceof Error ? error.message : 'Error desconocido'}</span>
        </div>
      )}

      {!isLoading && consumos.length === 0 && (
        <div className="py-12 text-center text-gray-400 text-sm">
          Aún no tienes almuerzos registrados este mes.
        </div>
      )}

      {/* Consumos List */}
      <div className="space-y-3">
        {consumos.map((item) => {
          const isPaid = item.paymentStatus === 'PAGADO';

          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/70 hover:bg-slate-100/80 border border-gray-200/70 transition duration-200"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border ${
                    isPaid
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-600'
                      : 'bg-amber-100 border-amber-300 text-amber-600'
                  }`}
                >
                  {isPaid ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Clock className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{item.date}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mt-0.5">
                    {item.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-xs uppercase font-semibold text-gray-400">Valor</p>
                  <p className="text-lg font-extrabold text-emerald-600 tracking-tight">
                    {item.price}
                  </p>
                </div>

                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                    isPaid
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {item.paymentStatus}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
