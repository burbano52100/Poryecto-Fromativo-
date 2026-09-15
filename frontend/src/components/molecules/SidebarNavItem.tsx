import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface SidebarNavItemProps {
  id: string;
  label: string;
  icon?: ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: string | number;
  hasSubItems?: boolean;
  isExpanded?: boolean;
  isSubItem?: boolean;
  roleVariant?: 'aprendiz' | 'instructor' | 'encargado' | 'invitado';
}

export const SidebarNavItem = ({
  label,
  icon,
  isActive,
  onClick,
  badge,
  hasSubItems = false,
  isExpanded = false,
  isSubItem = false,
  roleVariant = 'aprendiz',
}: SidebarNavItemProps) => {
  const activeStylesMap = {
    aprendiz: 'bg-emerald-50 text-emerald-800 font-bold border-l-4 border-emerald-600 shadow-xs',
    instructor: 'bg-indigo-50 text-indigo-800 font-bold border-l-4 border-indigo-600 shadow-xs',
    encargado: 'bg-amber-50 text-amber-900 font-bold border-l-4 border-amber-600 shadow-xs',
    invitado: 'bg-teal-50 text-teal-800 font-bold border-l-4 border-teal-600 shadow-xs',
  };

  const iconActiveMap = {
    aprendiz: 'text-emerald-600',
    instructor: 'text-indigo-600',
    encargado: 'text-amber-600',
    invitado: 'text-teal-600',
  };

  const badgeActiveMap = {
    aprendiz: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    instructor: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
    encargado: 'bg-amber-100 text-amber-800 border border-amber-300',
    invitado: 'bg-teal-100 text-teal-800 border border-teal-300',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between transition-all duration-200 cursor-pointer font-medium group ${
        isSubItem
          ? `pl-10 pr-4 py-2 rounded-lg text-xs ${
              isActive
                ? 'bg-emerald-100/70 text-emerald-900 font-bold border-l-2 border-emerald-600'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`
          : `px-4 py-3 rounded-xl text-sm ${
              isActive
                ? activeStylesMap[roleVariant]
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
            }`
      }`}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span
            className={`text-lg transition-colors ${
              isActive
                ? iconActiveMap[roleVariant]
                : 'text-gray-400 group-hover:text-gray-700'
            }`}
          >
            {icon}
          </span>
        )}
        <span className="tracking-wide">{label}</span>
      </div>

      <div className="flex items-center gap-2">
        {badge !== undefined && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              isActive
                ? badgeActiveMap[roleVariant]
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            {badge}
          </span>
        )}

        {hasSubItems && (
          <span className="text-gray-400 group-hover:text-gray-700 transition">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        )}
      </div>
    </button>
  );
};
