import type { ReactNode } from 'react';
import { EmptyState } from '@heroui/react';
import { Inbox } from 'lucide-react';

/** Mensaje de lista vacía (EmptyState de HeroUI) con un icono discreto. */
export const EmptyMessage = ({ children, icon }: { children: ReactNode; icon?: ReactNode }) => (
  <EmptyState className="flex flex-col items-center gap-2 py-10 text-center">
    <span className="text-muted/60">{icon ?? <Inbox className="size-8" />}</span>
    <p>{children}</p>
  </EmptyState>
);
