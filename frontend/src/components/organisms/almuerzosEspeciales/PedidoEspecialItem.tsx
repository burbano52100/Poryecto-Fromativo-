import { Card, Chip } from '@heroui/react';
import { Ban, HandCoins, PackageCheck } from 'lucide-react';
import { Button } from '../../atoms/Button';
import { fechaCorta, hoyBogota, pesos } from '../../../lib/formato';
import type { AlmuerzoEspecial } from '../../../types/api';

interface PedidoEspecialItemProps {
  pedido: AlmuerzoEspecial;
  onEntregar: (pedido: AlmuerzoEspecial) => void;
  onPagar: (pedido: AlmuerzoEspecial) => void;
  onCancelar: (pedido: AlmuerzoEspecial) => void;
}

/** Estado legible del pedido: lo que pasó y lo que falta. */
const estadoDe = (p: AlmuerzoEspecial): { texto: string; color: 'accent' | 'warning' | 'success' | 'default' } => {
  if (p.estado === 'cancelado') return { texto: 'Cancelado', color: 'default' };
  if (p.estado === 'programado') return { texto: 'Programado', color: 'accent' };
  return p.pagado ? { texto: 'Pagado', color: 'success' } : { texto: 'Por cobrar', color: 'warning' };
};

const fechaDeIso = (iso: string) => fechaCorta(new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));

/** Un almuerzo especial con su siguiente paso: entregarlo, cobrarlo o, si aún no se cocina, cancelarlo. */
export const PedidoEspecialItem = ({ pedido, onEntregar, onPagar, onCancelar }: PedidoEspecialItemProps) => {
  const estado = estadoDe(pedido);
  const esHoyOAntes = pedido.fecha <= hoyBogota();

  return (
    <Card variant="secondary" className="gap-3">
      <Card.Header className="flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title>{pedido.solicitante}</Card.Title>
            <Chip size="sm" variant="soft" color={estado.color}>
              {estado.texto}
            </Chip>
          </div>
          <p className="text-xs text-muted">
            {fechaCorta(pedido.fecha)} · {pedido.responsable}
            {pedido.numero_contrato && ` · Contrato ${pedido.numero_contrato}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-foreground">{pesos(pedido.total)}</p>
          <p className="text-xs tabular-nums text-muted">
            {pedido.cantidad_personas} × {pesos(pedido.precio_unitario)}
          </p>
        </div>
      </Card.Header>

      <Card.Content className="gap-1">
        <p className="text-sm text-foreground">{pedido.menu_descripcion}</p>
        <p className="text-xs text-muted">
          {pedido.receta_nombre ? `Receta: ${pedido.receta_nombre}` : 'Sin receta: no descuenta inventario'}
        </p>
      </Card.Content>

      {pedido.estado === 'programado' && (
        <Card.Footer className="flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="ghost" className="text-danger-soft-foreground" onPress={() => onCancelar(pedido)}>
            <Ban />
            Cancelar pedido
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {!esHoyOAntes && <span className="text-xs text-muted">Se entrega el {fechaCorta(pedido.fecha)}</span>}
            <Button size="sm" isDisabled={!esHoyOAntes} onPress={() => onEntregar(pedido)}>
              <PackageCheck />
              Marcar entregado
            </Button>
          </div>
        </Card.Footer>
      )}

      {pedido.estado === 'entregado' && !pedido.pagado && (
        <Card.Footer className="justify-end">
          <Button size="sm" onPress={() => onPagar(pedido)}>
            <HandCoins />
            Registrar pago
          </Button>
        </Card.Footer>
      )}

      {pedido.pagado && pedido.fecha_hora_pago && (
        <Card.Footer>
          <p className="text-xs text-muted">Pagado el {fechaDeIso(pedido.fecha_hora_pago)}: ya cuenta en Ventas</p>
        </Card.Footer>
      )}
    </Card>
  );
};
