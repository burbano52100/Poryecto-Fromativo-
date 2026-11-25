import { Card, Chip, Skeleton } from '@heroui/react';
import { Check, ImageOff, X } from 'lucide-react';
import { Button } from '../../atoms/Button';
import { useImagenComprobante } from '../../../hooks/usePagoQr';
import { fechaCorta, fechaHora, pesos } from '../../../lib/formato';
import type { ComprobantePago } from '../../../types/api';

interface ComprobanteRevisionItemProps {
  comprobante: ComprobantePago;
  onAprobar: (c: ComprobantePago) => void;
  onRechazar: (c: ComprobantePago) => void;
}

const ROL: Record<string, string> = { aprendiz: 'Aprendiz', instructor: 'Instructor' };

const horaLegible = (hora: string) => {
  const [hh, mm] = hora.split(':').map(Number);
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'a. m.' : 'p. m.'}`;
};

/** El motivo se le escribe a la persona; al encargado solo le sirve la razón, sin "El encargado revisará…". */
const razonDeRevision = (motivo: string) => motivo.replace(/\s*El encargado (?:lo )?revisará.*$/, '');

/** Un dato leído del comprobante, o "No se leyó" cuando el OCR no lo encontró. */
const Dato = ({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: string | null; alerta?: boolean }) => (
  <>
    <dt className="text-muted">{etiqueta}</dt>
    <dd className={valor && !alerta ? 'text-foreground' : 'text-warning-soft-foreground'}>{valor ?? 'No se leyó'}</dd>
  </>
);

/**
 * Comprobante que el lector no pudo confirmar (ADR 027): la captura al lado de lo que leyó, para que
 * el encargado compare y decida. Aprobar deja la reserva pagada; rechazar le da otros 15 minutos.
 */
export const ComprobanteRevisionItem = ({ comprobante: c, onAprobar, onRechazar }: ComprobanteRevisionItemProps) => {
  const imagen = useImagenComprobante(c.id, c.tiene_imagen);

  return (
    <Card variant="secondary" className="gap-4">
      <Card.Header className="flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title>{c.persona.nombre}</Card.Title>
            <Chip size="sm" variant="soft">
              {ROL[c.persona.rol] ?? c.persona.rol}
            </Chip>
          </div>
          <p className="text-xs text-muted">
            C.C. {c.persona.cedula}
            {c.persona.ficha && ` · Ficha ${c.persona.ficha}`} · Subido {fechaHora(c.subido_en)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-foreground">{pesos(c.reserva.precio)}</p>
          <p className="text-xs text-muted">{c.reserva.menu}</p>
        </div>
      </Card.Header>

      <Card.Content className="grid gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
        {imagen.data ? (
          <a href={imagen.data} target="_blank" rel="noreferrer" className="self-start" title="Ver la captura completa">
            <img src={imagen.data} alt={`Comprobante de ${c.persona.nombre}`} className="max-h-72 w-full rounded-lg object-contain" />
          </a>
        ) : imagen.isPending && c.tiene_imagen ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : (
          <p className="flex items-center gap-1.5 self-start text-xs text-muted">
            <ImageOff className="size-4" /> La captura no está disponible
          </p>
        )}

        <div className="flex flex-col gap-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <Dato etiqueta="Banco" valor={c.banco} />
            <Dato
              etiqueta="Valor"
              valor={c.valor !== null ? pesos(c.valor) : null}
              alerta={c.valor !== null && c.valor !== c.reserva.precio}
            />
            <Dato etiqueta="Fecha" valor={c.fecha_pago ? fechaCorta(c.fecha_pago) : null} />
            <Dato etiqueta="Hora" valor={c.hora_pago ? horaLegible(c.hora_pago) : null} />
            <Dato etiqueta="Comprobante" valor={c.numero} />
            <Dato etiqueta="Destinatario" valor={c.destinatario_ok ? 'Centro de Gestión' : null} />
          </dl>
          {c.motivo && <p className="text-xs text-muted">Por qué está en revisión: {razonDeRevision(c.motivo)}</p>}
        </div>
      </Card.Content>

      <Card.Footer className="flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" className="text-danger-soft-foreground" onPress={() => onRechazar(c)}>
          <X />
          Rechazar
        </Button>
        <Button size="sm" onPress={() => onAprobar(c)}>
          <Check />
          Aprobar pago
        </Button>
      </Card.Footer>
    </Card>
  );
};
