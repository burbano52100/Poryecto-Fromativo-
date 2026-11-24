import { useState } from 'react';
import { Award, Download } from 'lucide-react';
import { Card, Chip, Table } from '@heroui/react';
import { Button } from '../atoms/Button';
import { EstadoPagoBadge } from '../atoms/EstadoPagoBadge';
import { FranjaCifras } from '../molecules/FranjaCifras';
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
/** Almuerzo especial por contrato ya pagado (ADR 024): `cliente` es la dependencia y `ficha` el contrato. */
const esEspecial = (t: Transaccion) => t.origen === 'especial';

/** "Aprendiz" para una reserva; "Invitado · Corrientes" para un Almuerzo Invitado. */
const rolDeTransaccion = (t: Transaccion): string =>
  esEspecial(t)
    ? 'Almuerzo especial'
    : esInvitado(t)
      ? `Invitado · ${ETIQUETA_TIPO_INVITADO[t.rol as TipoAlmuerzoInvitado]?.corto ?? t.rol}`
      : t.rol.charAt(0).toUpperCase() + t.rol.slice(1);

const ORIGEN: Record<Transaccion['origen'], string> = {
  reserva: 'Reserva',
  invitado: 'Almuerzo invitado',
  especial: 'Almuerzo especial',
};

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
        ORIGEN[t.origen] ?? 'Reserva',
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
          <FranjaCifras
            etiqueta="Totales del período"
            cifras={[
              {
                etiqueta: 'Almuerzos servidos',
                valor: data.totales.almuerzosServidos,
                detalle:
                  `Incluye ${data.totales.almuerzosGratis} gratis de beneficiarios y ${data.totales.almuerzosInvitados} de invitados` +
                  (data.totales.almuerzosEspeciales > 0 ? `, más ${data.totales.almuerzosEspeciales} especiales` : ''),
              },
              {
                etiqueta: 'Cobrado',
                valor: pesos(data.totales.ingresosCobrados),
                detalle:
                  `Reservas pagadas y ${pesos(data.totales.ingresosInvitados)} de invitados` +
                  (data.totales.ingresosEspeciales > 0 ? `, más ${pesos(data.totales.ingresosEspeciales)} de especiales` : ''),
              },
              { etiqueta: 'Por cobrar', valor: pesos(data.totales.porCobrar), detalle: 'Reservas sin pagar' },
            ]}
          />

          <section aria-label="Almuerzos invitados del período">
            <SectionCard
              titulo="Almuerzos invitados del período"
              acciones={
                <Chip variant="soft" color="warning">
                  {textoPersonas(data.totales.almuerzosInvitados)} · {pesos(data.totales.ingresosInvitados)}
                </Chip>
              }
            >
              <FranjaCifras
                sinTarjeta
                etiqueta="Almuerzos invitados por tipo"
                cifras={TIPOS_ALMUERZO_INVITADO.map((tipo) => {
                  const totales = data.totales.invitadosPorTipo[tipo];
                  return {
                    etiqueta: ETIQUETA_TIPO_INVITADO[tipo].corto,
                    valor: pesos(totales.ingresos),
                    detalle: textoPersonas(totales.personas),
                  };
                })}
              />
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
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-success" /> Especiales
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
                        {item.count} almuerzos{item.invitados > 0 ? ` (${item.invitados} invitados)` : ''}
                        {item.especiales > 0 ? ` (${item.especiales} especiales)` : ''} · {pesos(item.ingresos)} cobrados
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-default">
                      <div className="flex h-2 overflow-hidden rounded-full" style={{ width: `${item.percent}%` }}>
                        <div className="h-2 bg-accent" style={{ flexGrow: item.count - item.invitados - item.especiales }} />
                        <div className="h-2 bg-warning" style={{ flexGrow: item.invitados }} />
                        <div className="h-2 bg-success" style={{ flexGrow: item.especiales }} />
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
                            {esInvitado(t) || esEspecial(t) ? textoPersonas(t.personas) : `C.C. ${t.cedula}`}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          {rolDeTransaccion(t)}
                          {t.ficha && (
                            <span className="block text-xs text-muted">
                              {esEspecial(t) ? 'Contrato' : 'Ficha'} {t.ficha}
                            </span>
                          )}
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
