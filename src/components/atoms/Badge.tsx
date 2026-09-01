import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'green' | 'amber' | 'blue' | 'red';
  className?: string;
}

export const Badge = ({ children, variant = 'green', className = '' }: BadgeProps) => {
  const variants = {
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-900 border-amber-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    red: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
