import { useState } from 'react';
import { Award, Clock, DollarSign, Download, ShoppingCart } from 'lucide-react';
import { Card, Chip, Table } from '@heroui/react';
import { Button } from '../atoms/Button';
import { EstadoPagoBadge } from '../atoms/EstadoPagoBadge';
import { StatCard } from '../atoms/StatCard';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SectionCard } from '../molecules/SectionCard';
import { SelectField } from '../molecules/SelectField';
import { useReporteVentas } from '../../hooks/useVentas';
import { fechaHora, pesos } from '../../lib/formato';
import { descargarCsv } from '../../lib/csv';
import { ETIQUETA_TIPO_INVITADO, TIPOS_ALMUERZO_INVITADO, textoPersonas } from '../../schemas/almuerzosInvitados.schema';
import type { PeriodoVentas, ReporteVentas, TipoAlmuerzoInvitado } from '../../types/api';
import { ESTILO_TIPO_INVITADO } from './almuerzosInvitados/estiloTipo';

const PERIODOS: PeriodoVentas[] = ['Día', 'Semana', 'Mes', 'Trimestre', 'Semestre', 'Año'];

const DESCRIPCION_PERIODO: Record<PeriodoVentas, string> = {
  Día: 'hoy',
  Semana: 'esta semana (desde el lunes)',
  Mes: 'este mes',
  Trimestre: 'este trimestre',
  Semestre: 'este semestre',
  Año: 'este año',
};

type Transaccion = ReporteVentas['transacciones'][number];

const esInvitado = (t: Transaccion) => t.origen === 'invitado';

/** "Aprendiz" para una reserva; "Invitado · Corrientes" para un Almuerzo Invitado. */
const rolDeTransaccion = (t: Transaccion): string =>
  esInvitado(t)
    ? `Invitado · ${ETIQUETA_TIPO_INVITADO[t.rol as TipoAlmuerzoInvitado]?.corto ?? t.rol}`
    : t.rol.charAt(0).toUpperCase() + t.rol.slice(1);

export const VentasSection = () => {
  const [period, setPeriod] = useState<PeriodoVentas>('Semana');
  const { data, isPending, isError, error, refetch, isFetching } = useReporteVentas(period);

  const exportar = () => {
    if (!data) return;
    descargarCsv(
      `ventas-${data.period}-${data.desde}.csv`,
      ['Fecha', 'Origen', 'Cliente', 'Cédula', 'Rol', 'Ficha', 'Menú', 'Personas', 'Estado de pago', 'Valor'],
      data.transacciones.map((t) => [
        fechaHora(t.fecha),
        esInvitado(t) ? 'Almuerzo invitado' : 'Reserva',
        t.cliente,
        t.cedula,
        rolDeTransaccion(t),
        t.ficha,
        t.menu,
        t.personas,
        t.estado_pago,
        t.precio,
      ])
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Historial de ventas</h3>
          <p className="text-sm text-muted">
            Reservas y almuerzos invitados {DESCRIPCION_PERIODO[period]}, en hora de Colombia
            {isFetching && !isPending ? ' · actualizando…' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SelectField
            label="Período"
            ocultarLabel
            className="w-40"
            value={period}
            onChange={(v) => setPeriod(v as PeriodoVentas)}
            opciones={PERIODOS.map((p) => ({ id: p, label: p }))}
          />
          <Button variant="outline" onPress={exportar} isDisabled={!data || data.transacciones.length === 0}>
            <Download /> CSV
          </Button>
        </div>
      </div>

      {isError && <ErrorAlert error={error} titulo="No se pudo consultar el reporte de ventas" onReintentar={() => refetch()} />}

      {isPending ? (
        <Card>
          <ListSkeleton label="Cargando métricas de ventas..." forma="tabla" filas={6} />
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Almuerzos servidos"
              value={data.totales.almuerzosServidos}
              subtitle={`Incluye ${data.totales.almuerzosGratis} gratis de beneficiarios y ${data.totales.almuerzosInvitados} de almuerzos invitados`}
              icon={<ShoppingCart className="size-5" />}
              tone="accent"
            />
            <StatCard
              title="Ingresos cobrados"
              value={pesos(data.totales.ingresosCobrados)}
              subtitle={`Reservas pagadas + ${pesos(data.totales.ingresosInvitados)} de almuerzos invitados`}
              icon={<DollarSign className="size-5" />}
              tone="success"
            />
            <StatCard
              title="Por cobrar"
              value={pesos(data.totales.porCobrar)}
              subtitle="Reservas pendientes de pago"
              icon={<Clock className="size-5" />}
              tone="warning"
            />
          </div>

          <section aria-label="Almuerzos invitados del período">
            <SectionCard
              titulo="Almuerzos invitados del período"
              acciones={
                <Chip variant="soft" color="warning">
                  {textoPersonas(data.totales.almuerzosInvitados)} · {pesos(data.totales.ingresosInvitados)}
                </Chip>
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {TIPOS_ALMUERZO_INVITADO.map((tipo) => {
                  const { icono: Icono, iconoFondo } = ESTILO_TIPO_INVITADO[tipo];
                  const totales = data.totales.invitadosPorTipo[tipo];
                  return (
                    <div key={tipo} className="flex items-center gap-3 rounded-xl bg-surface-secondary p-3">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconoFondo}`}>
                        <Icono className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted">{ETIQUETA_TIPO_INVITADO[tipo].corto}</p>
                        <p className="text-sm font-medium text-foreground">
                          {textoPersonas(totales.personas)} · {pesos(totales.ingresos)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </section>

          <SectionCard
            titulo="Distribución de ventas"
            descripcion={`Almuerzos por ${data.agrupacion === 'mes' ? 'mes' : 'día'} desde el ${data.desde}`}
            acciones={
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-accent" /> Reservas
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-warning" /> Almuerzos invitados
                </span>
              </div>
            }
          >
            {data.totales.almuerzosServidos === 0 ? (
              <EmptyMessage>No hay ventas registradas en el período seleccionado.</EmptyMessage>
            ) : (
              <div className="flex max-h-96 flex-col gap-4 overflow-y-auto pr-1">
                {data.breakdown.map((item) => (
                  <div key={item.fecha} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="capitalize text-foreground">{item.label}</span>
                      <span className="text-right text-muted">
                        {item.count} almuerzos{item.invitados > 0 ? ` (${item.invitados} invitados)` : ''} ·{' '}
                        {pesos(item.ingresos)} cobrados
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-default">
                      <div className="flex h-2 overflow-hidden rounded-full" style={{ width: `${item.percent}%` }}>
                        <div className="h-2 bg-accent" style={{ flexGrow: item.count - item.invitados }} />
                        <div className="h-2 bg-warning" style={{ flexGrow: item.invitados }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard titulo="Transacciones del período">
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Transacciones del período" className="min-w-[760px]">
                  <Table.Header>
                    <Table.Column>Fecha y hora</Table.Column>
                    <Table.Column isRowHeader>Cliente</Table.Column>
                    <Table.Column>Rol</Table.Column>
                    <Table.Column>Menú</Table.Column>
                    <Table.Column>Pago</Table.Column>
                    <Table.Column className="text-right">Valor</Table.Column>
                  </Table.Header>
                  <Table.Body renderEmptyState={() => <EmptyMessage>No hay ventas en este período.</EmptyMessage>}>
                    {data.transacciones.map((t) => (
                      <Table.Row key={t.id} id={t.id}>
                        <Table.Cell className="whitespace-nowrap text-xs text-muted">{fechaHora(t.fecha)}</Table.Cell>
                        <Table.Cell>
                          <span className="font-medium text-foreground">
                            {esInvitado(t) ? t.cliente || 'Almuerzo invitado' : t.cliente}
                          </span>
                          <span className="block text-xs text-muted">
                            {esInvitado(t) ? textoPersonas(t.personas) : `C.C. ${t.cedula}`}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          {rolDeTransaccion(t)}
                          {t.ficha && <span className="block text-xs text-muted">Ficha {t.ficha}</span>}
                        </Table.Cell>
                        <Table.Cell>{t.menu}</Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <EstadoPagoBadge estado={t.estado_pago} />
                            {t.beneficiario && (
                              <Chip size="sm" variant="soft" color="warning">
                                <Award className="size-3" />
                                <Chip.Label>Beneficiario</Chip.Label>
                              </Chip>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-right font-medium tabular-nums">{pesos(t.precio)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
};
