import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'emerald' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export const Button = ({
  variant = 'primary',
  fullWidth = false,
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 font-semibold transition duration-200 cursor-pointer rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-lg shadow-green-600/30 py-3 px-4',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 px-4',
    outline: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-xs py-2.5 px-4',
    emerald: 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 py-2.5 px-4 shadow-xs',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-600 py-2 px-3',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
};
