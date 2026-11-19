import { Chip, Separator } from '@heroui/react';
import { Fragment } from 'react';
import { ConsumoRow } from '../molecules/ConsumoRow';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SectionCard } from '../molecules/SectionCard';
import { useConsumos } from '../../hooks/useConsumos';

interface HistorialConsumosProps {
  titulo: string;
  descripcion: string;
  unidad: string;
  vacio: string;
}

/** Lista de almuerzos del usuario con su estado de pago (aprendiz e instructor). */
export const HistorialConsumos = ({ titulo, descripcion, unidad, vacio }: HistorialConsumosProps) => {
  const { data: consumos = [], isPending, isError, error, refetch } = useConsumos();

  return (
    <SectionCard
      titulo={titulo}
      descripcion={descripcion}
      acciones={
        !isPending && (
          <Chip variant="soft" color="accent">
            {consumos.length} {unidad}
          </Chip>
        )
      }
    >
      {isPending ? (
        <ListSkeleton label="Cargando historial..." />
      ) : isError ? (
        <ErrorAlert error={error} titulo="No se pudo cargar el historial" onReintentar={() => refetch()} />
      ) : consumos.length === 0 ? (
        <EmptyMessage>{vacio}</EmptyMessage>
      ) : (
        <div>
          {consumos.map((consumo, i) => (
            <Fragment key={consumo.id}>
              {i > 0 && <Separator />}
              <ConsumoRow consumo={consumo} />
            </Fragment>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

/** Mis Fichas del aprendiz: cada reserva con su estado y si ya está pagada. */
export const MisFichasSection = () => (
  <HistorialConsumos
    titulo="Mis fichas y consumos"
    descripcion="Tus reservas de almuerzo y su estado de pago"
    unidad="fichas"
    vacio="Aún no has reservado almuerzos. Hazlo desde Inicio."
  />
);
