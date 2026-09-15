import { TrendingUp } from 'lucide-react';

export interface ProgressCardProps {
  consumedLunches?: number;
  message?: string;
}

export const ProgressCard = ({
  consumedLunches = 5,
  message = '¡Mantén una alimentación balanceada!',
}: ProgressCardProps) => {
  return (
    <div className="bg-amber-50/70 border border-amber-100 rounded-3xl p-5 sm:p-6 flex items-start gap-4 shadow-xs">
      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
        <TrendingUp className="w-6 h-6" />
      </div>

      <div>
        <h3 className="text-base sm:text-lg font-bold text-amber-950 tracking-tight">
          Tu Progreso
        </h3>
        <p className="text-sm text-amber-900/80 mt-1 font-medium leading-relaxed">
          Has utilizado <span className="font-bold text-amber-700">{consumedLunches} fichas</span> este mes.{' '}
          <span>{message}</span>
        </p>
      </div>
    </div>
  );
};
