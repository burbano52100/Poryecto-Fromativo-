import { CheckCircle2, Receipt, Calendar } from 'lucide-react';
import { Badge } from '../atoms/Badge';

export interface FichaItem {
  id: string;
  date: string;
  title: string;
  price: string;
  status: 'CONSUMED' | 'RESERVED';
}

export interface MisFichasSectionProps {
  history?: FichaItem[];
}

export const MisFichasSection = ({ history }: MisFichasSectionProps) => {
  const defaultHistory: FichaItem[] = [
    { id: '1', date: '17 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '2', date: '16 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '3', date: '15 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '4', date: '14 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '5', date: '13 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
  ];

  const items = history || defaultHistory;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-green-600" />
            Fichas Utilizadas
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">
            Historial de almuerzos consumidos
          </p>
        </div>

        <Badge variant="green" className="text-sm py-1.5 px-3.5 font-extrabold">
          {items.length} fichas
        </Badge>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/70 hover:bg-emerald-50/40 border border-gray-200/70 hover:border-emerald-200 transition duration-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
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

            <div className="text-right">
              <p className="text-xs uppercase font-semibold text-gray-400">Valor</p>
              <p className="text-lg font-extrabold text-emerald-600 tracking-tight">
                {item.price}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
