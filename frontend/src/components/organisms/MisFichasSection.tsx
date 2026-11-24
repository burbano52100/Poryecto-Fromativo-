import { Chip, Separator, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Fragment, useState } from 'react';
import { Button } from '../atoms/Button';
import { ConsumoRow } from '../molecules/ConsumoRow';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SectionCard } from '../molecules/SectionCard';
import { useConsumos } from '../../hooks/useConsumos';
import { pesos } from '../../lib/formato';
import { agruparPorMes } from '../../lib/historial';

interface HistorialConsumosProps {
  titulo: string;
  descripcion: string;
  vacio: string;
}

type Filtro = 'todos' | 'porPagar';

/** Meses que se ven al abrir; los anteriores se cargan con "Ver meses anteriores". */
const MESES_POR_PAGINA = 2;

const textoAlmuerzos = (n: number) => `${n} ${n === 1 ? 'almuerzo' : 'almuerzos'}`;

/**
 * Historial de almuerzos del usuario (aprendiz e instructor). Con el tiempo son cientos, así que
 * va por meses: se ven los dos más recientes y los anteriores se piden con un botón. El filtro
 * "Por pagar" deja solo los que falta pagar en la ventanilla.
 */
export const HistorialConsumos = ({ titulo, descripcion, vacio }: HistorialConsumosProps) => {
  const { data: consumos = [], isPending, isError, error, refetch } = useConsumos();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [mesesVisibles, setMesesVisibles] = useState(MESES_POR_PAGINA);

  const porPagar = consumos.filter((c) => c.estado_pago === 'pendiente');
  const meses = agruparPorMes(filtro === 'porPagar' ? porPagar : consumos);
  const visibles = meses.slice(0, mesesVisibles);
  const ocultos = meses.length - visibles.length;

  return (
    <SectionCard
      titulo={titulo}
      descripcion={descripcion}
      acciones={
        !isPending &&
        consumos.length > 0 && (
          <ToggleButtonGroup
            aria-label="Qué almuerzos mostrar"
            selectionMode="single"
            disallowEmptySelection
            size="sm"
            selectedKeys={[filtro]}
            onSelectionChange={(keys) => {
              const [elegido] = keys;
              if (elegido) {
                setFiltro(elegido as Filtro);
                setMesesVisibles(MESES_POR_PAGINA);
              }
            }}
          >
            <ToggleButton id="todos">Todos</ToggleButton>
            <ToggleButton id="porPagar">
              <ToggleButtonGroup.Separator />
              Por pagar ({porPagar.length})
            </ToggleButton>
          </ToggleButtonGroup>
        )
      }
    >
      {isPending ? (
        <ListSkeleton label="Cargando historial..." />
      ) : isError ? (
        <ErrorAlert error={error} titulo="No se pudo cargar el historial" onReintentar={() => refetch()} />
      ) : consumos.length === 0 ? (
        <EmptyMessage>{vacio}</EmptyMessage>
      ) : meses.length === 0 ? (
        <EmptyMessage>No tienes almuerzos por pagar.</EmptyMessage>
      ) : (
        <div className="flex flex-col gap-6">
          {visibles.map((mes) => (
            <section key={mes.clave} aria-label={mes.nombre}>
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-separator pb-2">
                <h4 className="font-semibold text-foreground">{mes.nombre}</h4>
                <p className="text-sm text-muted">
                  {textoAlmuerzos(mes.consumos.length)} · <span className="tabular-nums">{pesos(mes.total)}</span>
                </p>
              </header>
              {mes.consumos.map((consumo, i) => (
                <Fragment key={consumo.id}>
                  {i > 0 && <Separator />}
                  <ConsumoRow consumo={consumo} />
                </Fragment>
              ))}
            </section>
          ))}

          {ocultos > 0 && (
            <Button variant="secondary" className="self-center" onPress={() => setMesesVisibles((n) => n + MESES_POR_PAGINA)}>
              Ver meses anteriores
              <Chip size="sm" variant="soft">
                {ocultos}
              </Chip>
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  );
};

/** Mis fichas del aprendiz: cada reserva con su estado y si ya está pagada, por meses. */
export const MisFichasSection = () => (
  <HistorialConsumos
    titulo="Mis fichas"
    descripcion="Tus reservas de almuerzo y su estado de pago, mes a mes"
    vacio="Aún no has reservado almuerzos. Hazlo desde Inicio."
  />
);
