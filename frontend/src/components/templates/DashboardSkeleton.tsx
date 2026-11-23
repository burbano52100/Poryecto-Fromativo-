import { Card } from '@heroui/react';
import { Hueso } from '../atoms/Hueso';

/**
 * Forma del panel mientras se verifica la sesión o se descarga el panel del rol: barra lateral,
 * encabezado, tarjetas de métricas y una sección. Un solo brillo recorre todo (Skeleton de HeroUI).
 */
export const DashboardSkeleton = ({ label = 'Cargando panel...' }: { label?: string }) => (
  <div role="status" aria-label={label} className="skeleton--shimmer relative min-h-screen overflow-hidden bg-background">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-4 border-r border-separator bg-surface p-4 lg:flex">
      <div className="flex items-center gap-2.5 px-1 py-1">
        <Hueso className="size-8 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Hueso className="h-3.5 w-24 rounded-md" />
          <Hueso className="h-3 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-surface-secondary p-3">
        <Hueso className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Hueso className="h-3.5 w-3/4 rounded-md" />
          <Hueso className="h-3 w-1/2 rounded-md" />
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Hueso key={i} className="h-9 rounded-lg" />
        ))}
      </div>
    </aside>

    <div className="lg:ml-64">
      <div className="flex items-center justify-between border-b border-separator px-4 py-3 sm:px-8">
        <div className="flex flex-col gap-1.5">
          <Hueso className="h-5 w-40 rounded-md" />
          <Hueso className="h-3 w-28 rounded-md" />
        </div>
        <Hueso className="size-8 rounded-full" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Misma forma que FranjaCifras: una sola superficie con las cifras separadas por líneas */}
        <Card className="grid grid-cols-2 gap-x-4 gap-y-5 p-5 sm:flex sm:flex-row sm:gap-0 sm:divide-x sm:divide-separator">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-1 sm:px-5 sm:first:pl-0 sm:last:pr-0">
              <Hueso className="h-3 w-1/2 rounded-md" />
              <Hueso className="h-7 w-24 rounded-md" />
              <Hueso className="h-3 w-3/4 rounded-md" />
            </div>
          ))}
        </Card>
        <Card className="gap-4 p-5 sm:p-6">
          <Hueso className="h-4 w-48 rounded-md" />
          <Hueso className="h-3 w-72 max-w-full rounded-md" />
          <div className="flex flex-col gap-3 pt-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Hueso key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
    </div>
    <span className="sr-only">{label}</span>
  </div>
);
