import { forwardRef } from 'react';
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
  ({ label, error, icon, rightElement, required, className = '', ...props }, ref) => {
    return (
      <div className={`space-y-1 ${className}`}>
        <Label required={required}>{label}</Label>
        <Input
          ref={ref}
          icon={icon}
          rightElement={rightElement}
          hasError={!!error}
          {...props}
        />
        {error && <p className="text-xs text-red-500 font-medium pl-1">{error}</p>}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
