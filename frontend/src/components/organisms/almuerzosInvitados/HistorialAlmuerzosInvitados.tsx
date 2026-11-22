import { Pencil, Trash2 } from 'lucide-react';
import { Button, Chip, Table, Tooltip } from '@heroui/react';
import { EmptyMessage } from '../../molecules/EmptyMessage';
import { ETIQUETA_TIPO_INVITADO } from '../../../schemas/almuerzosInvitados.schema';
import { fechaHora, pesos } from '../../../lib/formato';
import type { AlmuerzoInvitado } from '../../../types/api';
import { ESTILO_TIPO_INVITADO } from './estiloTipo';

interface HistorialAlmuerzosInvitadosProps {
  registros: AlmuerzoInvitado[];
  onEditar: (registro: AlmuerzoInvitado) => void;
  onEliminar: (registro: AlmuerzoInvitado) => void;
}

/** Tabla del historial: cada registro con su número de personas, precio guardado y total. */
export const HistorialAlmuerzosInvitados = ({ registros, onEditar, onEliminar }: HistorialAlmuerzosInvitadosProps) => (
  <Table variant="secondary">
    <Table.ScrollContainer>
      <Table.Content aria-label="Historial de almuerzos invitados" className="min-w-[860px]">
        <Table.Header>
          <Table.Column>Fecha y hora</Table.Column>
          <Table.Column isRowHeader>Tipo</Table.Column>
          <Table.Column className="text-right">Personas</Table.Column>
          <Table.Column className="text-right">Precio unitario</Table.Column>
          <Table.Column className="text-right">Total</Table.Column>
          <Table.Column>Nombre o nota</Table.Column>
          <Table.Column>Registró</Table.Column>
          <Table.Column className="text-right">Acciones</Table.Column>
        </Table.Header>
        <Table.Body
          renderEmptyState={() => <EmptyMessage>No hay almuerzos invitados registrados en este período.</EmptyMessage>}
        >
          {registros.map((registro) => (
            <Table.Row key={registro.id} id={registro.id}>
              <Table.Cell className="whitespace-nowrap text-xs text-muted">{fechaHora(registro.fecha_hora)}</Table.Cell>
              <Table.Cell>
                <Chip size="sm" variant="soft" color={ESTILO_TIPO_INVITADO[registro.tipo].color}>
                  {ETIQUETA_TIPO_INVITADO[registro.tipo].corto}
                </Chip>
              </Table.Cell>
              <Table.Cell className="text-right font-medium tabular-nums text-foreground">{registro.cantidad}</Table.Cell>
              <Table.Cell className="text-right tabular-nums">{pesos(registro.precio_unitario)}</Table.Cell>
              <Table.Cell className="text-right font-medium tabular-nums text-foreground">{pesos(registro.total)}</Table.Cell>
              <Table.Cell>
                <span className="block max-w-48 truncate" title={registro.nombre_invitado ?? undefined}>
                  {registro.nombre_invitado || '—'}
                </span>
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap">{registro.registrado_por.nombre || '—'}</Table.Cell>
              <Table.Cell>
                <div className="flex justify-end gap-1">
                  <Tooltip delay={400}>
                    <Button isIconOnly size="sm" variant="ghost" aria-label="Editar registro" onPress={() => onEditar(registro)}>
                      <Pencil />
                    </Button>
                    <Tooltip.Content>Editar</Tooltip.Content>
                  </Tooltip>
                  <Tooltip delay={400}>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      aria-label="Eliminar registro"
                      onPress={() => onEliminar(registro)}
                    >
                      <Trash2 />
                    </Button>
                    <Tooltip.Content>Eliminar</Tooltip.Content>
                  </Tooltip>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Content>
    </Table.ScrollContainer>
  </Table>
);
