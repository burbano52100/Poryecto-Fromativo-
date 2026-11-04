import { User, Presentation, ClipboardList, Ticket } from 'lucide-react';
import type { RegistrableAccountType } from '../../schemas/auth.schema';
import { AccountTypeButton } from '../atoms/AccountTypeButton';

interface AccountTypeSelectorProps {
  selectedType: RegistrableAccountType;
  onSelect: (type: RegistrableAccountType) => void;
}

const OPCIONES: { id: RegistrableAccountType; label: string; icon: typeof User }[] = [
  { id: 'aprendiz', label: 'Aprendiz', icon: User },
  { id: 'invitado', label: 'Invitado', icon: Ticket },
  { id: 'instructor', label: 'Instructor', icon: Presentation },
  { id: 'encargado', label: 'Encargado', icon: ClipboardList },
];

/** Tipo de cuenta del registro. Instructor y encargado quedan pendientes de aprobación (ADR 015). */
export const AccountTypeSelector = ({ selectedType, onSelect }: AccountTypeSelectorProps) => {
  return (
    <div className="mb-5">
      <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
        Tipo de Cuenta
      </span>
      <div className="grid grid-cols-2 gap-2">
        {OPCIONES.map(({ id, label, icon: Icono }) => (
          <AccountTypeButton
            key={id}
            id={id}
            label={label}
            icon={<Icono className="w-4 h-4" />}
            isActive={selectedType === id}
            onClick={onSelect}
          />
        ))}
      </div>
    </div>
  );
};
