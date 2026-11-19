import { forwardRef, useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { Label, TextArea } from '@heroui/react';
import { FieldMessage } from '../atoms/FieldMessage';

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
}

/** Área de texto de HeroUI con etiqueta y error, compatible con `register` de react-hook-form. */
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, error, description, required, className = '', id, rows = 4, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const descriptionId = `${inputId}-description`;

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <Label htmlFor={inputId} isRequired={required} isInvalid={!!error}>
          {label}
        </Label>
        <TextArea
          ref={ref}
          id={inputId}
          rows={rows}
          fullWidth
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : description ? descriptionId : undefined}
          {...props}
        />
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

TextAreaField.displayName = 'TextAreaField';
