import { useState } from 'react';
import { Download, Wallet } from 'lucide-react';
import { Chip, Table, toast } from '@heroui/react';
import { Button } from '../atoms/Button';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { FormField } from '../molecules/FormField';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SearchInput } from '../molecules/SearchInput';
import { SectionCard } from '../molecules/SectionCard';
import { useCartera, usePagarDeuda } from '../../hooks/useCartera';
import { pesos } from '../../lib/formato';
import { filtrarNumero } from '../../lib/numeros';
import { descargarCsv } from '../../lib/csv';
import type { Deuda } from '../../types/api';

/**
 * Cartera de deudas de instructores. Un pago (total o abono) marca como pagados sus
 * almuerzos más antiguos; los aprendices se cobran en Grupos.
 */
export const CarteraDeudasSection = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deudaAPagar, setDeudaAPagar] = useState<Deuda | null>(null);
  const [montoTexto, setMontoTexto] = useState('');

  const { data: deudores = [], isPending, isError, error, refetch } = useCartera();
  const pagarDeuda = usePagarDeuda();

  const monto = montoTexto.trim() === '' ? undefined : Number(montoTexto);
  const montoInvalido = monto !== undefined && (!Number.isFinite(monto) || monto <= 0);

  const abrirPago = (deuda: Deuda) => {
    pagarDeuda.reset();
    setMontoTexto('');
    setDeudaAPagar(deuda);
  };

  const confirmarPago = () => {
    if (!deudaAPagar || montoInvalido) return;
    const deuda = deudaAPagar;
    pagarDeuda.mutate(
      { id: deuda.id, monto },
      {
        onSuccess: (res) => {
          setDeudaAPagar(null);
          toast.success(
            res.saldoRestante > 0
              ? `${res.message} ${deuda.name} queda debiendo ${pesos(res.saldoRestante)}.`
              : `${res.message} La deuda de ${deuda.name} quedó saldada.`
          );
        },
      }
    );
  };

  const exportar = () =>
    descargarCsv(
      'cartera-deudas.csv',
      ['Deudor', 'Tipo', 'Cédula', 'Almuerzos', 'Deuda', 'Días', 'Estado'],
      deudores.map((d) => [d.name, d.type, d.document, d.lunchesCount, d.debt, d.daysOverdue, d.status])
    );

  const filteredDeudores = deudores.filter(
    (d) => d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.document.includes(searchTerm)
  );

  const totalDeudoresCount = deudores.length;
  const totalDebtSum = deudores.reduce((acc, d) => acc + d.debt, 0);
  const avgDebt = totalDeudoresCount > 0 ? totalDebtSum / totalDeudoresCount : 0;
  const maxDebt = deudores.reduce((max, d) => (d.debt > max ? d.debt : max), 0);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        titulo="Cartera de deudas de instructores"
        descripcion="Saldos pendientes y cobranza del comedor"
        acciones={
          <>
            <SearchInput
              label="Buscar deudor"
              placeholder="Buscar por nombre o cédula"
              value={searchTerm}
              onChange={setSearchTerm}
            />
            <Button variant="outline" onPress={exportar} isDisabled={deudores.length === 0}>
              <Download /> Exportar CSV
            </Button>
          </>
        }
      >

        {isPending ? (
          <ListSkeleton label="Cargando cartera..." forma="tabla" />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudo cargar la cartera" onReintentar={() => refetch()} />
        ) : (
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Cartera de deudas" className="min-w-[720px]">
                <Table.Header>
                  <Table.Column isRowHeader>Instructor</Table.Column>
                  <Table.Column>Cédula</Table.Column>
                  <Table.Column>Almuerzos</Table.Column>
                  <Table.Column>Deuda total</Table.Column>
                  <Table.Column>Días</Table.Column>
                  <Table.Column>Estado</Table.Column>
                  <Table.Column className="text-right">Acción</Table.Column>
                </Table.Header>
                <Table.Body renderEmptyState={() => <EmptyMessage>No hay deudas pendientes en este momento.</EmptyMessage>}>
                  {filteredDeudores.map((deudor) => (
                    <Table.Row key={deudor.id} id={deudor.id}>
                      <Table.Cell>
                        <span className="font-medium text-foreground">{deudor.name}</span>
                        <span className="block text-xs text-muted">{deudor.type}</span>
                      </Table.Cell>
                      <Table.Cell className="tabular-nums">{deudor.document}</Table.Cell>
                      <Table.Cell className="tabular-nums">{deudor.lunchesCount}</Table.Cell>
                      <Table.Cell className="font-medium tabular-nums text-foreground">{pesos(deudor.debt)}</Table.Cell>
                      <Table.Cell>{deudor.daysOverdue} días</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={deudor.status === 'VENCIDA' ? 'danger' : 'success'}>
                          {deudor.status === 'VENCIDA' ? 'Vencida' : 'Activa'}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Button size="sm" onPress={() => abrirPago(deudor)}>
                          Registrar pago
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </SectionCard>

      <SectionCard titulo="Resumen de cartera">
        <dl className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-surface-secondary p-4">
            <dt className="text-xs text-muted">Deudores</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totalDeudoresCount}</dd>
          </div>
          <div className="rounded-xl bg-surface-secondary p-4">
            <dt className="text-xs text-muted">Promedio</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{pesos(avgDebt)}</dd>
          </div>
          <div className="rounded-xl bg-surface-secondary p-4">
            <dt className="text-xs text-muted">Mayor deuda</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-danger">{pesos(maxDebt)}</dd>
          </div>
        </dl>
      </SectionCard>

      <ConfirmDialog
        abierto={deudaAPagar !== null}
        titulo="Registrar pago de deuda"
        icono={<Wallet className="size-5" />}
        textoConfirmar={monto === undefined ? 'Pagar total' : `Abonar ${montoInvalido ? '' : pesos(monto)}`}
        onConfirmar={confirmarPago}
        onCancelar={() => setDeudaAPagar(null)}
        cargando={pagarDeuda.isPending}
      >
        {deudaAPagar && (
          <div className="flex flex-col gap-3">
            <p>
              <span className="font-medium text-foreground">{deudaAPagar.name}</span> debe{' '}
              <span className="font-medium text-foreground">{pesos(deudaAPagar.debt)}</span> ({deudaAPagar.lunchesCount}{' '}
              almuerzos).
            </p>
            <FormField
              id="monto-abono"
              label="Monto a abonar (déjalo vacío para pagar el total)"
              inputMode="numeric"
              placeholder={String(deudaAPagar.debt)}
              value={montoTexto}
              onChange={(e) => {
                filtrarNumero(e, 'entero');
                setMontoTexto(e.target.value);
              }}
              error={montoInvalido ? 'El monto debe ser mayor a 0.' : undefined}
              description="El pago marca como pagados los almuerzos más antiguos que alcance a cubrir."
            />
            {pagarDeuda.isError && <ErrorAlert error={pagarDeuda.error} titulo="No se pudo registrar el pago" />}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};
