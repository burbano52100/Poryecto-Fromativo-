import { Card, Chip, Skeleton } from '@heroui/react';
import type { ReactNode } from 'react';

type Tono = 'accent' | 'success' | 'warning' | 'danger' | 'default';

export interface StatCardProps {
  title: string;
  /** `undefined` mientras carga: se muestra un Skeleton. */
  value: string | number | undefined;
  subtitle?: string;
  icon: ReactNode;
  tone?: Tono;
  badgeText?: string;
}

const ICONO: Record<Tono, string> = {
  accent: 'bg-accent-soft text-accent-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  danger: 'bg-danger-soft text-danger-soft-foreground',
  default: 'bg-default text-default-foreground',
};

/** Métrica del encabezado del panel: título, valor y un icono a la derecha. */
export const StatCard = ({ title, value, subtitle, icon, tone = 'accent', badgeText }: StatCardProps) => (
  <Card className="flex-row items-center justify-between gap-3">
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted">{title}</p>
        {badgeText && (
          <Chip size="sm" variant="soft" color={tone === 'default' ? 'default' : tone}>
            {badgeText}
          </Chip>
        )}
      </div>
      {value === undefined ? (
        <Skeleton className="mt-2 h-7 w-24 rounded-md" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      )}
      {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
    </div>
    <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${ICONO[tone]}`}>{icon}</div>
  </Card>
);
