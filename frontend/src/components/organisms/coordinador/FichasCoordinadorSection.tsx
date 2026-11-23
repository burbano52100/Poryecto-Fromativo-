import { useState } from 'react';
import { Flag, RotateCcw } from 'lucide-react';
import { Chip, toast } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { ConfirmDialog } from '../../molecules/ConfirmDialog';
import { EmptyMessage } from '../../molecules/EmptyMessage';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { ListSkeleton } from '../../molecules/ListSkeleton';
import { SectionCard } from '../../molecules/SectionCard';
import { useCambiarEstadoFicha, useFichasCoordinador } from '../../../hooks/useCoordinador';
import type { FichaCoordinador } from '../../../types/api';

/**
 * Fichas (ADR 018): el Coordinador las marca como finalizadas cuando termina la formación. Al
 * finalizar una ficha terminan los beneficios de almuerzo de sus aprendices.
 */
export const FichasCoordinadorSection = () => {
  const { data: fichas = [], isPending, isError, error, refetch } = useFichasCoordinador();
  const cambiarEstado = useCambiarEstadoFicha();
  const [aCambiar, setACambiar] = useState<FichaCoordinador | null>(null);
  const mostrarAviso = (texto: string) => toast.success(texto);

  const finalizar = aCambiar?.estado === 'activa';

  const confirmar = () => {
    if (!aCambiar) return;
    cambiarEstado.mutate(
      { id: aCambiar.id, estado: finalizar ? 'finalizada' : 'activa' },
      {
        onSuccess: (res) => {
          setACambiar(null);
          mostrarAviso(res.message);
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard titulo="Fichas" descripcion="Programas de formación del centro y cuántos aprendices activos tiene cada uno.">

        {isPending ? (
          <ListSkeleton label="Cargando fichas..." />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar las fichas" onReintentar={() => refetch()} />
        ) : fichas.length === 0 ? (
          <EmptyMessage>Todavía no hay fichas registradas.</EmptyMessage>
        ) : (
          <ul className="divide-y divide-separator" aria-label="Fichas">
            {fichas.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className={`min-w-0 ${f.estado === 'activa' ? '' : 'opacity-75'}`}>
                  <p className="font-medium text-foreground">{f.programa}</p>
                  <p className="text-xs text-muted">
                    Ficha {f.codigo_ficha} · {f.aprendices} {f.aprendices === 1 ? 'aprendiz activo' : 'aprendices activos'}
                    {f.jornada && <span className="capitalize"> · Jornada {f.jornada}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip size="sm" variant="soft" color={f.estado === 'activa' ? 'success' : 'default'}>
                    {f.estado === 'activa' ? 'Activa' : 'Finalizada'}
                  </Chip>
                  <Button
                    size="sm"
                    variant={f.estado === 'activa' ? 'outline' : 'secondary'}
                    className="shrink-0"
                    onPress={() => {
                      cambiarEstado.reset();
                      setACambiar(f);
                    }}
                  >
                    {f.estado === 'activa' ? (
                      <>
                        <Flag /> Finalizar
                      </>
                    ) : (
                      <>
                        <RotateCcw /> Reactivar
                      </>
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ConfirmDialog
        abierto={aCambiar !== null}
        titulo={finalizar ? 'Finalizar ficha' : 'Reactivar ficha'}
        icono={finalizar ? <Flag className="size-5" /> : <RotateCcw className="size-5" />}
        textoConfirmar={finalizar ? 'Finalizar ficha' : 'Reactivar ficha'}
        variante={finalizar ? 'warning' : 'accent'}
        onConfirmar={confirmar}
        onCancelar={() => setACambiar(null)}
        cargando={cambiarEstado.isPending}
      >
        <div className="flex flex-col gap-3">
          <p>
            La ficha <strong>{aCambiar?.codigo_ficha}</strong> ({aCambiar?.programa}) quedará{' '}
            {finalizar ? 'finalizada' : 'activa'}.
          </p>
          {finalizar && (
            <p className="text-xs text-warning">
              Terminarán los beneficios de almuerzo de sus aprendices y se avisará al Encargado.
            </p>
          )}
          {cambiarEstado.isError && <ErrorAlert error={cambiarEstado.error} titulo="No se pudo cambiar el estado" />}
        </div>
      </ConfirmDialog>
    </div>
  );
};
