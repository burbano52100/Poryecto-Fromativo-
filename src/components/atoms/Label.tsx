import type { LabelHTMLAttributes, ReactNode } from 'react';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
}

export const Label = ({ children, required, className = '', ...props }: LabelProps) => {
  return (
    <label className={`block text-xs sm:text-sm font-semibold text-gray-800 mb-1 ${className}`} {...props}>
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
};
