import { forwardRef, useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button, InputGroup, Label } from '@heroui/react';
import { FieldMessage } from '../atoms/FieldMessage';
import { limpiarNumero } from '../../lib/numeros';

interface NumberStepperProps {
  label: string;
  /** Valor del campo como texto (solo dígitos), igual que los demás campos numéricos. */
  value: string;
  onChange: (valor: string) => void;
  onBlur?: () => void;
  name?: string;
  min?: number;
  max?: number;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Entero con botones − y + (InputGroup de HeroUI); también se puede escribir.
 * Solo acepta dígitos y los botones no salen del rango [min, max]. El total
 * se actualiza con cada tecla, por eso no usa NumberField (que confirma al salir).
 */
export const NumberStepper = forwardRef<HTMLInputElement, NumberStepperProps>(
  ({ label, value, onChange, onBlur, name, min = 1, max = Number.MAX_SAFE_INTEGER, error, required, disabled }, ref) => {
    const inputId = useId();
    const errorId = `${inputId}-error`;
    const actual = /^\d+$/.test(value) ? Number(value) : 0;

    const cambiar = (delta: number) => onChange(String(Math.min(max, Math.max(min, actual + delta))));

    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={inputId} isRequired={required} isInvalid={!!error}>
          {label}
        </Label>
        <InputGroup fullWidth isInvalid={!!error} isDisabled={disabled}>
          <InputGroup.Prefix className="pl-1">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => cambiar(-1)}
              isDisabled={disabled || actual <= min}
              aria-label={`Restar uno a ${label.toLowerCase()}`}
            >
              <Minus />
            </Button>
          </InputGroup.Prefix>
          <InputGroup.Input
            ref={ref}
            id={inputId}
            name={name}
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(limpiarNumero(e.target.value, 'entero'))}
            onBlur={onBlur}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="text-center text-base font-semibold tabular-nums"
          />
          <InputGroup.Suffix className="pr-1">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => cambiar(1)}
              isDisabled={disabled || actual >= max}
              aria-label={`Sumar uno a ${label.toLowerCase()}`}
            >
              <Plus />
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
        {error && <FieldMessage id={errorId}>{error}</FieldMessage>}
      </div>
    );
  }
);

NumberStepper.displayName = 'NumberStepper';
