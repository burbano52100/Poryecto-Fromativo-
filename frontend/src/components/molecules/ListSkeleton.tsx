import { Hueso } from '../atoms/Hueso';

interface ListSkeletonProps {
  /** Texto para lectores de pantalla mientras carga. */
  label: string;
  filas?: number;
  /** `lista`: filas con avatar · `tabla`: encabezado y columnas · `tarjetas`: cuadrícula de tarjetas. */
  forma?: 'lista' | 'tabla' | 'tarjetas';
}

const Fila = ({ forma, i }: { forma: 'lista' | 'tabla'; i: number }) =>
  forma === 'tabla' ? (
    <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-4 py-1">
      <div className="flex flex-col gap-1.5">
        <Hueso className={`h-3.5 rounded-md ${i % 2 ? 'w-3/5' : 'w-4/5'}`} />
        <Hueso className="h-3 w-2/5 rounded-md" />
      </div>
      <Hueso className="h-3.5 w-3/4 rounded-md" />
      <Hueso className="h-3.5 w-1/2 rounded-md" />
      <Hueso className="h-6 w-16 rounded-full" />
    </div>
  ) : (
    <div className="flex items-center gap-3">
      <Hueso className="size-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Hueso className={`h-3.5 rounded-md ${i % 2 ? 'w-1/3' : 'w-2/5'}`} />
        <Hueso className="h-3 w-1/4 rounded-md" />
      </div>
      <Hueso className="h-6 w-20 rounded-full" />
    </div>
  );

/**
 * Marcador de carga con Skeleton de HeroUI. Un solo brillo recorre todos los huesos a la vez
 * (clase `skeleton--shimmer` en el contenedor y `animationType="none"` en cada Skeleton).
 */
export const ListSkeleton = ({ label, filas = 4, forma = 'lista' }: ListSkeletonProps) => (
  <div role="status" aria-label={label} className="skeleton--shimmer relative overflow-hidden rounded-xl">
    {forma === 'tarjetas' ? (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl bg-surface-secondary p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Hueso className="h-3 w-1/4 rounded-md" />
                <Hueso className="h-4 w-3/4 rounded-md" />
              </div>
              <Hueso className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Hueso className="h-3 w-2/5 rounded-md" />
              <Hueso className="h-8 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {forma === 'tabla' && (
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 rounded-lg bg-surface-secondary px-0 py-2.5">
            <Hueso className="ml-3 h-3 w-1/3 rounded-md" />
            <Hueso className="h-3 w-1/2 rounded-md" />
            <Hueso className="h-3 w-1/2 rounded-md" />
            <Hueso className="mr-3 h-3 w-12 rounded-md" />
          </div>
        )}
        {Array.from({ length: filas }, (_, i) => (
          <Fila key={i} forma={forma} i={i} />
        ))}
      </div>
    )}
    <span className="sr-only">{label}</span>
  </div>
);
