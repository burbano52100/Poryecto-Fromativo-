import { User, GraduationCap, ShieldCheck } from 'lucide-react';
import type { AccountType } from '../../schemas/auth.schema';
import { AccountTypeButton } from '../atoms/AccountTypeButton';

interface AccountTypeSelectorProps {
  selectedType: AccountType;
  onSelect: (type: AccountType) => void;
}

export const AccountTypeSelector = ({ selectedType, onSelect }: AccountTypeSelectorProps) => {
  return (
    <div className="mb-5">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
        Tipo de Cuenta
      </label>
      <div className="grid grid-cols-3 gap-2">
        <AccountTypeButton
          id="aprendiz"
          label="Aprendiz"
          icon={<User className="w-4 h-4" />}
          isActive={selectedType === 'aprendiz'}
          onClick={onSelect}
        />
        <AccountTypeButton
          id="instructor"
          label="Instructor"
          icon={<GraduationCap className="w-4 h-4" />}
          isActive={selectedType === 'instructor'}
          onClick={onSelect}
        />
        <AccountTypeButton
          id="encargado"
          label="Encargado"
          icon={<ShieldCheck className="w-4 h-4" />}
          isActive={selectedType === 'encargado'}
          onClick={onSelect}
        />
      </div>
    </div>
  );
};
