import { CreditCard, Info, DollarSign, CalendarCheck } from 'lucide-react';

export interface MiCuentaSectionProps {
  totalConsumed?: string | number;
  pendingBalance?: string | number;
  paymentMethod?: string;
  paymentFrequency?: string;
  nextCutoffDate?: string;
}

export const MiCuentaSection = ({
  totalConsumed = '$25.000',
  pendingBalance = '$15.000',
  paymentMethod = 'Efectivo en oficina del comedor',
  paymentFrequency = 'Mensual',
  nextCutoffDate = '28 de Febrero 2026',
}: MiCuentaSectionProps) => {
  const formattedConsumed =
    typeof totalConsumed === 'number'
      ? `$${totalConsumed.toLocaleString('es-CO')}`
      : totalConsumed;

  const formattedBalance =
    typeof pendingBalance === 'number'
      ? `$${pendingBalance.toLocaleString('es-CO')}`
      : pendingBalance;

  const hasPendingBalance =
    typeof pendingBalance === 'number'
      ? pendingBalance > 0
      : pendingBalance !== '$0' && pendingBalance !== '$0.00';

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-6">
      <div className="pb-4 border-b border-gray-100">
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-green-600" />
          Resumen de Cuenta Mensual
        </h2>
        <p className="text-sm text-gray-500 mt-1 font-medium">
          Estado de tu cuenta y pagos pendientes
        </p>
      </div>

      {/* Top 2 Cards: Total Consumido & Saldo Actual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Total Consumido
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-black text-blue-900 tracking-tight">
              {formattedConsumed}
            </p>
            <p className="text-xs text-blue-700/80 mt-1 font-medium">Acumulado del mes</p>
          </div>
        </div>

        <div
          className={`border rounded-2xl p-6 flex flex-col justify-between ${
            hasPendingBalance
              ? 'bg-amber-50/70 border-amber-200'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                hasPendingBalance ? 'text-amber-800' : 'text-emerald-800'
              }`}
            >
              Saldo Actual
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                hasPendingBalance
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p
              className={`text-3xl font-black tracking-tight ${
                hasPendingBalance ? 'text-amber-900' : 'text-emerald-900'
              }`}
            >
              {formattedBalance}
            </p>
            <p
              className={`text-xs mt-1 font-medium ${
                hasPendingBalance ? 'text-amber-800/80' : 'text-emerald-800/80'
              }`}
            >
              {hasPendingBalance ? 'Pago pendiente' : 'Cuenta al día'}
            </p>
          </div>
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-extrabold text-blue-950 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600" />
          Información de Pago
        </h3>

        <div className="space-y-2 text-sm text-blue-900">
          <p>
            <span className="font-bold">Método de pago:</span> {paymentMethod}
          </p>
          <p>
            <span className="font-bold">Frecuencia:</span> {paymentFrequency}
          </p>
          <p>
            <span className="font-bold">Próximo corte:</span> {nextCutoffDate}
          </p>
        </div>

        <p className="text-xs text-blue-700/80 pt-2 border-t border-blue-200/60 font-medium">
          Contacta al encargado para realizar tu pago o solicitar un estado de cuenta detallado.
        </p>
      </div>
    </div>
  );
};
