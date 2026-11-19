import { useState } from 'react';
import { Chip, Table } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { EmptyMessage } from '../../molecules/EmptyMessage';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { FormField } from '../../molecules/FormField';
import { ListSkeleton } from '../../molecules/ListSkeleton';
import { SectionCard } from '../../molecules/SectionCard';
import { SelectField } from '../../molecules/SelectField';
import { useKardex, useMateriales } from '../../../hooks/useInventario';
import type { FiltrosKardex, TipoKardex } from '../../../types/api';

const COLOR_TIPO: Record<TipoKardex, 'success' | 'warning' | 'danger' | 'accent'> = {
  entrada: 'success',
  salida: 'warning',
  merma: 'danger',
  ajuste: 'accent',
};

const TODOS = 'todos';

export const KardexView = () => {
  const [filtros, setFiltros] = useState<FiltrosKardex>({});
  const { data: materiales = [] } = useMateriales();
  const { data, isPending, isError, error, refetch } = useKardex(filtros);

  // Un campo vacío quita el filtro (no se envía al backend)
  const cambiar = <K extends keyof FiltrosKardex>(campo: K, valor: string) =>
    setFiltros((prev) => {
      const siguiente = { ...prev };
      if (valor === '' || valor === TODOS) delete siguiente[campo];
      else siguiente[campo] = valor as FiltrosKardex[K];
      return siguiente;
    });

  return (
    <SectionCard titulo="Kardex de movimientos" descripcion="Historial de entradas, salidas y mermas del inventario">
      <div className="grid items-end gap-3 rounded-xl bg-surface-secondary p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_1.5fr_auto]">
        <FormField label="Desde" type="date" value={filtros.desde ?? ''} onChange={(e) => cambiar('desde', e.target.value)} />
        <FormField label="Hasta" type="date" value={filtros.hasta ?? ''} onChange={(e) => cambiar('hasta', e.target.value)} />
        <SelectField
          label="Material"
          value={filtros.material_id ?? TODOS}
          onChange={(v) => cambiar('material_id', v)}
          opciones={[{ id: TODOS, label: 'Todos los materiales' }, ...materiales.map((m) => ({ id: m.id, label: m.name }))]}
        />
        <SelectField
          label="Movimiento"
          value={filtros.tipo ?? TODOS}
          onChange={(v) => cambiar('tipo', v)}
          opciones={[
            { id: TODOS, label: 'Todos los movimientos' },
            { id: 'entrada', label: 'Entrada' },
            { id: 'salida', label: 'Salida' },
            { id: 'merma', label: 'Merma' },
            { id: 'ajuste', label: 'Ajuste' },
          ]}
        />
        <Button variant="ghost" onPress={() => setFiltros({})} isDisabled={Object.keys(filtros).length === 0}>
          Limpiar filtros
        </Button>
      </div>

      {isPending ? (
        <ListSkeleton label="Cargando movimientos..." forma="tabla" />
      ) : isError ? (
        <ErrorAlert error={error} titulo="No se pudo cargar el Kardex" onReintentar={() => refetch()} />
      ) : (
        <>
          <p className="text-xs text-muted">
            {data.total} movimiento{data.total === 1 ? '' : 's'}
            {data.total > data.items.length ? ` (se muestran los ${data.items.length} más recientes)` : ''}
          </p>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Movimientos del Kardex" className="min-w-[900px]">
                <Table.Header>
                  <Table.Column>Fecha y hora</Table.Column>
                  <Table.Column isRowHeader>Material</Table.Column>
                  <Table.Column>Tipo</Table.Column>
                  <Table.Column>Concepto</Table.Column>
                  <Table.Column>Responsable</Table.Column>
                  <Table.Column>Entrada</Table.Column>
                  <Table.Column>Salida</Table.Column>
                  <Table.Column className="text-right">Saldo</Table.Column>
                </Table.Header>
                <Table.Body renderEmptyState={() => <EmptyMessage>No hay movimientos con estos filtros.</EmptyMessage>}>
                  {data.items.map((mov) => (
                    <Table.Row key={mov.id} id={mov.id}>
                      <Table.Cell className="whitespace-nowrap text-xs text-muted">{mov.date}</Table.Cell>
                      <Table.Cell className="font-medium text-foreground">{mov.material}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={COLOR_TIPO[mov.tipo]} className="capitalize">
                          {mov.tipo}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>{mov.concepto}</Table.Cell>
                      <Table.Cell>{mov.responsible}</Table.Cell>
                      <Table.Cell className="whitespace-nowrap font-medium tabular-nums text-success">{mov.entry}</Table.Cell>
                      <Table.Cell className="whitespace-nowrap font-medium tabular-nums text-danger">{mov.exit}</Table.Cell>
                      <Table.Cell className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                        {mov.saldo} {mov.unidad}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </>
      )}
    </SectionCard>
  );
};
