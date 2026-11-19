import { useState } from 'react';
import { Flag, RotateCcw, Users } from 'lucide-react';
import { Card, Chip, toast } from '@heroui/react';
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
          <ListSkeleton label="Cargando fichas..." forma="tarjetas" />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar las fichas" onReintentar={() => refetch()} />
        ) : fichas.length === 0 ? (
          <EmptyMessage>Todavía no hay fichas registradas.</EmptyMessage>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" aria-label="Fichas">
            {fichas.map((f) => (
              <li key={f.id}>
                <Card variant="secondary" className={`h-full ${f.estado === 'activa' ? '' : 'opacity-75'}`}>
                  <Card.Header className="flex-row items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">Ficha {f.codigo_ficha}</p>
                      <Card.Title>{f.programa}</Card.Title>
                    </div>
                    <Chip size="sm" variant="soft" color={f.estado === 'activa' ? 'success' : 'default'} className="shrink-0">
                      {f.estado === 'activa' ? 'Activa' : 'Finalizada'}
                    </Chip>
                  </Card.Header>
                  <Card.Footer className="mt-auto justify-between gap-3">
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" /> {f.aprendices} aprendiz(es) activo(s)
                      </span>
                      {f.jornada && <span className="capitalize">Jornada {f.jornada}</span>}
                    </p>
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
                  </Card.Footer>
                </Card>
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
