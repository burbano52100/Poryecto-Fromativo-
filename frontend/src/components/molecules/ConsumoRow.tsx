import { CheckCircle2, Clock, Calendar } from 'lucide-react';
import { EstadoPagoBadge } from '../atoms/EstadoPagoBadge';
import type { Consumo } from '../../types/api';

/**
 * Un almuerzo del historial: si sigue reservado (menú de hoy) o ya fue consumido,
 * y su estado de pago tal como lo marcó el Encargado.
 */
export const ConsumoRow = ({ consumo }: { consumo: Consumo }) => {
  const reservado = consumo.status === 'RESERVED';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gray-50/70 hover:bg-emerald-50/40 border border-gray-200/70 hover:border-emerald-200 transition duration-200">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border ${
            reservado ? 'bg-blue-100 border-blue-300 text-blue-600' : 'bg-emerald-100 border-emerald-300 text-emerald-600'
          }`}
        >
          {reservado ? <Clock className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{consumo.date}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                reservado ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {reservado ? 'Reservado' : 'Consumido'}
            </span>
          </div>
          <h3 className="text-base font-bold text-gray-800 mt-0.5 truncate">{consumo.title}</h3>
        </div>
      </div>

      <div className="flex items-center gap-4 text-right">
        <div>
          <p className="text-xs uppercase font-semibold text-gray-400">Valor</p>
          <p className="text-lg font-extrabold text-emerald-600 tracking-tight">{consumo.price}</p>
        </div>
        <EstadoPagoBadge estado={consumo.estado_pago} />
      </div>
    </div>
  );
};
