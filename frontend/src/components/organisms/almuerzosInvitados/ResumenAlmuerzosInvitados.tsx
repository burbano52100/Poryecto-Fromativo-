import { Table } from '@heroui/react';
import { ETIQUETA_TIPO_INVITADO, TIPOS_ALMUERZO_INVITADO } from '../../../schemas/almuerzosInvitados.schema';
import { fechaCorta, pesos } from '../../../lib/formato';
import type { ResumenAlmuerzosInvitados as Resumen } from '../../../types/api';
import { SectionCard } from '../../molecules/SectionCard';

interface PanelProps {
  titulo: string;
  subtitulo: string;
  totales: Resumen['dia'];
}

const PanelTotales = ({ titulo, subtitulo, totales }: PanelProps) => (
  <section aria-label={titulo}>
    <SectionCard titulo={titulo} descripcion={subtitulo} className="h-full">
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label={titulo}>
            <Table.Header>
              <Table.Column isRowHeader>Tipo</Table.Column>
              <Table.Column className="text-right">Personas</Table.Column>
              <Table.Column className="text-right">Total</Table.Column>
            </Table.Header>
            <Table.Body>
              {TIPOS_ALMUERZO_INVITADO.map((tipo) => (
                <Table.Row key={tipo} id={tipo}>
                  <Table.Cell>{ETIQUETA_TIPO_INVITADO[tipo].corto}</Table.Cell>
                  <Table.Cell className="text-right tabular-nums">{totales.porTipo[tipo].personas}</Table.Cell>
                  <Table.Cell className="text-right tabular-nums">{pesos(totales.porTipo[tipo].total)}</Table.Cell>
                </Table.Row>
              ))}
              <Table.Row id="total" className="font-semibold text-foreground">
                <Table.Cell>Total general</Table.Cell>
                <Table.Cell className="text-right tabular-nums">{totales.personas}</Table.Cell>
                <Table.Cell className="text-right tabular-nums">{pesos(totales.total)}</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </SectionCard>
  </section>
);

/** Personas y pesos de hoy y del período filtrado, por tipo y en total. */
export const ResumenAlmuerzosInvitados = ({ resumen }: { resumen: Resumen }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <PanelTotales titulo="Resumen de hoy" subtitulo={fechaCorta(resumen.hoy)} totales={resumen.dia} />
    <PanelTotales
      titulo="Resumen del período"
      subtitulo={
        resumen.desde === resumen.hasta
          ? fechaCorta(resumen.desde)
          : `${fechaCorta(resumen.desde)} – ${fechaCorta(resumen.hasta)}`
      }
      totales={resumen.periodo}
    />
  </div>
);
