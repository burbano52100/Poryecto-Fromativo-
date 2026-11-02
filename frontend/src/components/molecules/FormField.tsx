import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Label } from '../atoms/Label';
import { Input } from '../atoms/Input';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
  required?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, icon, rightElement, required, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className={`space-y-1 ${className}`}>
        <Label htmlFor={inputId} required={required}>{label}</Label>
        <Input
          ref={ref}
          id={inputId}
          icon={icon}
          rightElement={rightElement}
          hasError={!!error}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {error && <p id={errorId} className="text-xs text-red-500 font-medium pl-1">{error}</p>}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
