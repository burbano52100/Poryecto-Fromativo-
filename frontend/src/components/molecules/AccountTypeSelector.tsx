import { User, Ticket } from 'lucide-react';
import type { RegistrableAccountType } from '../../schemas/auth.schema';
import { AccountTypeButton } from '../atoms/AccountTypeButton';

interface AccountTypeSelectorProps {
  selectedType: RegistrableAccountType;
  onSelect: (type: RegistrableAccountType) => void;
}

/** Tipo de cuenta del registro público: solo Aprendiz o Invitado. */
export const AccountTypeSelector = ({ selectedType, onSelect }: AccountTypeSelectorProps) => {
  return (
    <div className="mb-5">
      <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
        Tipo de Cuenta
      </span>
      <div className="grid grid-cols-2 gap-2">
        <AccountTypeButton
          id="aprendiz"
          label="Aprendiz"
          icon={<User className="w-4 h-4" />}
          isActive={selectedType === 'aprendiz'}
          onClick={onSelect}
        />
        <AccountTypeButton
          id="invitado"
          label="Invitado"
          icon={<Ticket className="w-4 h-4" />}
          isActive={selectedType === 'invitado'}
          onClick={onSelect}
        />
      </div>
    </div>
  );
};
