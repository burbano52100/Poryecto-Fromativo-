import { CheckCircle2, Clock, Receipt, Calendar } from 'lucide-react';
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

export const ConsumosSection = ({ items }: ConsumosSectionProps) => {
  const defaultItems: ConsumoItem[] = [
    { id: '1', date: '16 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PAGADO' },
    { id: '2', date: '15 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PAGADO' },
    { id: '3', date: '14 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PENDIENTE' },
    { id: '4', date: '13 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PENDIENTE' },
    { id: '5', date: '12 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PENDIENTE' },
  ];

  const consumos = items || defaultItems;

  const totalConsumosCount = consumos.length;
  
  const totalPaidAmount = consumos
    .filter((item) => item.paymentStatus === 'PAGADO')
    .reduce((acc, item) => acc + parseInt(item.price.replace(/\D/g, '') || '0', 10), 0);

  const totalPendingAmount = consumos
    .filter((item) => item.paymentStatus === 'PENDIENTE')
    .reduce((acc, item) => acc + parseInt(item.price.replace(/\D/g, '') || '0', 10), 0);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-green-600" />
            Consumos
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">
            Historial de almuerzos y estado de pago
          </p>
        </div>

        <Badge variant="blue" className="text-sm py-1.5 px-3.5 font-extrabold">
          {totalConsumosCount} consumos
        </Badge>
      </div>

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
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {isPaid ? 'Pagado' : 'Pendiente'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen del Mes Bottom Card */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-6">
        <h3 className="text-base font-extrabold text-blue-950 mb-4">
          Resumen del Mes
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Total Consumos
            </p>
            <p className="text-2xl font-black text-blue-900 mt-1">
              {totalConsumosCount}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Total Pagado
            </p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              ${totalPaidAmount.toLocaleString('es-CO')}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Pendiente
            </p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              ${totalPendingAmount.toLocaleString('es-CO')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
