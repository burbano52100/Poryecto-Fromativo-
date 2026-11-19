import { Spinner } from '@heroui/react';

interface LoadingSpinnerProps {
  label?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner = ({ label, fullScreen = false }: LoadingSpinnerProps) => (
  <div
    role="status"
    className={`flex flex-col items-center justify-center gap-3 ${fullScreen ? 'min-h-screen bg-background' : 'py-10'}`}
  >
    <Spinner size="lg" />
    {label && <p className="text-sm text-muted">{label}</p>}
  </div>
);
