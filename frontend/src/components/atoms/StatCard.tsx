import type { ReactNode } from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variant?: 'green' | 'emerald' | 'amber' | 'blue' | 'purple' | 'teal';
  badgeText?: string;
}

export const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'green',
  badgeText,
}: StatCardProps) => {
  const variantStyles = {
    green: {
      bgIcon: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      textValue: 'text-emerald-700',
      badgeBg: 'bg-emerald-100 text-emerald-800',
      borderAccent: 'border-l-4 border-l-emerald-600',
    },
    emerald: {
      bgIcon: 'bg-green-500/10 text-green-600 border-green-500/20',
      textValue: 'text-green-700',
      badgeBg: 'bg-green-100 text-green-800',
      borderAccent: 'border-l-4 border-l-green-600',
    },
    amber: {
      bgIcon: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      textValue: 'text-amber-700',
      badgeBg: 'bg-amber-100 text-amber-800',
      borderAccent: 'border-l-4 border-l-amber-500',
    },
    blue: {
      bgIcon: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      textValue: 'text-blue-700',
      badgeBg: 'bg-blue-100 text-blue-800',
      borderAccent: 'border-l-4 border-l-blue-600',
    },
    purple: {
      bgIcon: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      textValue: 'text-purple-700',
      badgeBg: 'bg-purple-100 text-purple-800',
      borderAccent: 'border-l-4 border-l-purple-600',
    },
    teal: {
      bgIcon: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
      textValue: 'text-teal-700',
      badgeBg: 'bg-teal-100 text-teal-800',
      borderAccent: 'border-l-4 border-l-teal-600',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100/80 hover:shadow-md transition-all duration-200 flex items-center justify-between ${style.borderAccent}`}>
      <div className="flex-1 pr-3">
        <div className="flex items-center gap-2">
          <p className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
          {badgeText && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badgeBg}`}>
              {badgeText}
            </span>
          )}
        </div>
        <p className={`text-xl sm:text-2xl font-extrabold mt-1 tracking-tight ${style.textValue}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5 font-medium truncate">{subtitle}</p>
        )}
      </div>

      <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border ${style.bgIcon}`}>
        {icon}
      </div>
    </div>
  );
};
