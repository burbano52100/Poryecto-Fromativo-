import { useState } from 'react';
import { CreditCard, Search, Send, Download, AlertTriangle, CheckCircle2, Edit2 } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';

export interface DeudorItem {
  id: string;
  name: string;
  type: string;
  document: string;
  debt: number;
  lunchesCount: number;
  daysOverdue: number;
  status: 'VENCIDA' | 'ACTIVA';
}

export const CarteraDeudasSection = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deudores, setDeudores] = useState<DeudorItem[]>([
    { id: '1', name: 'María Fernanda Gómez', type: 'Instructor', document: '1098765432', debt: 15000, lunchesCount: 3, daysOverdue: 5, status: 'VENCIDA' },
    { id: '2', name: 'Carlos Mario Benítez', type: 'Instructor', document: '1087654321', debt: 25000, lunchesCount: 5, daysOverdue: 12, status: 'VENCIDA' },
    { id: '3', name: 'Sandra Milena Rojas', type: 'Instructor', document: '1076543210', debt: 10000, lunchesCount: 2, daysOverdue: 2, status: 'ACTIVA' },
  ]);

  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const handlePay = (id: string, name: string) => {
    setDeudores(deudores.filter((d) => d.id !== id));
    setPaymentSuccess(`Se registró el pago total de la deuda de ${name}.`);
    setTimeout(() => setPaymentSuccess(null), 4000);
  };

  const filteredDeudores = deudores.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.document.includes(searchTerm)
  );

  const totalDeudoresCount = deudores.length;
  const totalDebtSum = deudores.reduce((acc, d) => acc + d.debt, 0);
  const avgDebt = totalDeudoresCount > 0 ? totalDebtSum / totalDeudoresCount : 0;
  const maxDebt = deudores.reduce((max, d) => (d.debt > max ? d.debt : max), 0);

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-green-600" />
              Cartera de Deudas de Instructores
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Gestión de saldos pendientes y cobranza del comedor escolar
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar por nombre o C.C..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>
        </div>

        {paymentSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{paymentSuccess}</span>
          </div>
        )}

        {/* Listado de Deudores Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Instructor / Deudor</th>
                <th className="py-3 px-4">Cédula</th>
                <th className="py-3 px-4">Almuerzos</th>
                <th className="py-3 px-4">Deuda Total</th>
                <th className="py-3 px-4">Días Vencidos</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredDeudores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 font-medium">
                    No hay deudores registrados en este momento.
                  </td>
                </tr>
              ) : (
                filteredDeudores.map((deudor) => (
                  <tr key={deudor.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-4 px-4 font-bold text-gray-900">
                      {deudor.name}
                      <span className="block text-xs text-gray-400 font-normal">{deudor.type}</span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-gray-700">{deudor.document}</td>
                    <td className="py-4 px-4 font-bold text-gray-800">{deudor.lunchesCount}</td>
                    <td className="py-4 px-4 font-extrabold text-amber-600">
                      ${deudor.debt.toLocaleString('es-CO')}
                    </td>
                    <td className="py-4 px-4 font-medium text-gray-600">{deudor.daysOverdue} días</td>
                    <td className="py-4 px-4">
                      {deudor.status === 'VENCIDA' ? (
                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200">
                          Vencida
                        </span>
                      ) : (
                        <Badge variant="green">Activa</Badge>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <Button
                        variant="primary"
                        onClick={() => handlePay(deudor.id, deudor.name)}
                        className="bg-green-600 hover:bg-green-700 text-xs py-1.5 px-3 font-bold"
                      >
                        Pagar
                      </Button>
                      <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Acciones Rápidas y Resumen Financiero de Deudas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Acciones Rápidas */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-4">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-emerald-600" />
            Acciones Rápidas
          </h3>

          <div className="space-y-3">
            <button
              onClick={() => alert('Recordatorio enviado a todos los instructores con deudas activas.')}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-800 font-bold text-sm hover:bg-emerald-100 transition cursor-pointer"
            >
              <span>Enviar Recordatorio Masivo</span>
              <Send className="w-4 h-4" />
            </button>

            <button
              onClick={() => alert('Exportando reporte de cartera de deudas en formato PDF / Excel...')}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-800 font-bold text-sm hover:bg-blue-100 transition cursor-pointer"
            >
              <span>Exportar Reporte de Deudas</span>
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-4">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Resumen de Cartera
          </h3>

          <div className="grid grid-cols-3 gap-3 text-center pt-2">
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/70">
              <p className="text-xs text-gray-400 font-bold uppercase">Deudores</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{totalDeudoresCount}</p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/70">
              <p className="text-xs text-gray-400 font-bold uppercase">Promedio</p>
              <p className="text-lg font-extrabold text-amber-600 mt-1.5">
                ${Math.round(avgDebt).toLocaleString('es-CO')}
              </p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/70">
              <p className="text-xs text-gray-400 font-bold uppercase">Mayor Deuda</p>
              <p className="text-lg font-extrabold text-red-600 mt-1.5">
                ${maxDebt.toLocaleString('es-CO')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
