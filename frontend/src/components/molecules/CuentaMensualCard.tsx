import { CreditCard, ArrowRight } from 'lucide-react';

export interface CuentaMensualCardProps {
  pendingBalance?: string | number;
  onViewAccount?: () => void;
}

export const CuentaMensualCard = ({
  pendingBalance = '$15.000',
  onViewAccount,
}: CuentaMensualCardProps) => {
  const formattedBalance =
    typeof pendingBalance === 'number'
      ? `$${pendingBalance.toLocaleString('es-CO')}`
      : pendingBalance;

  return (
    <div className="bg-amber-50/70 border border-amber-100 rounded-3xl p-5 sm:p-6 flex items-start justify-between gap-4 shadow-xs">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
          <CreditCard className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-bold text-amber-950 tracking-tight">
            Cuenta Mensual
          </h3>
          <p className="text-sm text-amber-900/80 mt-1 font-medium leading-relaxed">
            Como instructor, puedes consumir almuerzos y pagar mensualmente.
          </p>
          <p className="text-sm font-bold text-amber-800 mt-2">
            Saldo actual: <span className="text-base font-extrabold text-amber-700">{formattedBalance}</span>
          </p>
        </div>
      </div>

      {onViewAccount && (
        <button
          onClick={onViewAccount}
          className="self-center p-2.5 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 transition font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <span className="hidden sm:inline">Ver Cuenta</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
