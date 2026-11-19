import { Skeleton } from '@heroui/react';

interface ListSkeletonProps {
  /** Texto para lectores de pantalla mientras carga. */
  label: string;
  filas?: number;
  /** `tabla` dibuja columnas; `lista` dibuja filas con avatar. */
  forma?: 'lista' | 'tabla';
}

/** Marcador de carga con Skeleton de HeroUI para listas y tablas. */
export const ListSkeleton = ({ label, filas = 4, forma = 'lista' }: ListSkeletonProps) => (
  <div role="status" aria-label={label} className="flex flex-col gap-3">
    {Array.from({ length: filas }, (_, i) =>
      forma === 'tabla' ? (
        <div key={i} className="grid grid-cols-4 gap-4">
          <Skeleton className="h-4 rounded-md" />
          <Skeleton className="h-4 rounded-md" />
          <Skeleton className="h-4 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      ) : (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5 rounded-md" />
            <Skeleton className="h-3 w-1/4 rounded-md" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      )
    )}
    <span className="sr-only">{label}</span>
  </div>
);
