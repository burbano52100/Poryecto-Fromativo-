import type { ReactNode } from 'react';
import type { RegistrableAccountType } from '../../schemas/auth.schema';

interface AccountTypeButtonProps {
  id: RegistrableAccountType;
  label: string;
  icon: ReactNode;
  isActive: boolean;
  onClick: (id: RegistrableAccountType) => void;
}

export const AccountTypeButton = ({
  id,
  label,
  icon,
  isActive,
  onClick,
}: AccountTypeButtonProps) => {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => onClick(id)}
      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
        isActive
          ? 'bg-green-600 text-white shadow-md shadow-green-600/30 scale-[1.02] border border-green-600'
          : 'bg-white text-gray-700 border border-gray-300 hover:border-green-500 hover:bg-gray-50 hover:text-green-700'
      }`}
    >
      <div className={`p-1.5 rounded-full ${isActive ? 'bg-white/20' : 'text-gray-500'}`}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
};
