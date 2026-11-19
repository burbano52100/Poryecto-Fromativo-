import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Input, InputGroup, Label } from '@heroui/react';
import { FieldMessage } from '../atoms/FieldMessage';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  description?: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
  required?: boolean;
}

/**
 * Campo de texto de HeroUI (Label + Input/InputGroup) con su mensaje de error o ayuda.
 * El input queda sin controlar para que funcione directo con `register` de react-hook-form.
 */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, description, icon, rightElement, required, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const descriptionId = `${inputId}-description`;
    const describedBy = [error ? errorId : null, description ? descriptionId : null].filter(Boolean).join(' ') || undefined;

    const inputProps = {
      ref,
      id: inputId,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy,
      ...props,
    };

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <Label htmlFor={inputId} isRequired={required} isInvalid={!!error}>
          {label}
        </Label>
        {icon || rightElement ? (
          <InputGroup fullWidth isInvalid={!!error} isDisabled={props.disabled}>
            {icon && <InputGroup.Prefix className="text-muted">{icon}</InputGroup.Prefix>}
            <InputGroup.Input {...inputProps} />
            {rightElement && <InputGroup.Suffix>{rightElement}</InputGroup.Suffix>}
          </InputGroup>
        ) : (
          <Input fullWidth {...inputProps} />
        )}
        {description && !error && (
          <FieldMessage id={descriptionId} tipo="ayuda">
            {description}
          </FieldMessage>
        )}
        {error && <FieldMessage id={errorId}>{error}</FieldMessage>}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
