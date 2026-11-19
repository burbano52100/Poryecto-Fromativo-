import { Label, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Presentation, User } from 'lucide-react';
import type { RegistrableAccountType } from '../../schemas/auth.schema';

interface AccountTypeSelectorProps {
  selectedType: RegistrableAccountType;
  onSelect: (type: RegistrableAccountType) => void;
}

/** Tipo de cuenta del registro. Ambos quedan pendientes de aprobación del Coordinador (ADR 018). */
export const AccountTypeSelector = ({ selectedType, onSelect }: AccountTypeSelectorProps) => (
  <div className="flex flex-col gap-1.5">
    <Label id="tipo-cuenta">Tipo de cuenta</Label>
    <ToggleButtonGroup
      aria-labelledby="tipo-cuenta"
      selectionMode="single"
      disallowEmptySelection
      fullWidth
      selectedKeys={[selectedType]}
      onSelectionChange={(keys) => {
        const [tipo] = keys;
        if (tipo) onSelect(tipo as RegistrableAccountType);
      }}
    >
      <ToggleButton id="aprendiz">
        <User />
        Aprendiz
      </ToggleButton>
      <ToggleButton id="instructor">
        <ToggleButtonGroup.Separator />
        <Presentation />
        Instructor
      </ToggleButton>
    </ToggleButtonGroup>
  </div>
);
