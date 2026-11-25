import { useState } from 'react';
import { Chip, toast } from '@heroui/react';
import { BadgeCheck, CircleX } from 'lucide-react';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { FranjaCifras } from '../molecules/FranjaCifras';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SectionCard } from '../molecules/SectionCard';
import { TextAreaField } from '../molecules/TextAreaField';
import { ComprobanteRevisionItem } from './comprobantes/ComprobanteRevisionItem';
import {
  useAprobarComprobante,
  useComprobantes,
  useRechazarComprobante,
  useResumenComprobantes,
} from '../../hooks/usePagoQr';
import { pesos } from '../../lib/formato';
import type { ComprobantePago, EstadoComprobante } from '../../types/api';

const ESTADO: Record<EstadoComprobante, { texto: string; color: 'success' | 'warning' | 'danger' }> = {
  aceptado: { texto: 'Confirmado', color: 'success' },
  en_revision: { texto: 'En revisión', color: 'warning' },
  rechazado: { texto: 'No aceptado', color: 'danger' },
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });

/**
 * Pagos con el código QR (ADR 027). Lo primero son los comprobantes que el lector no pudo confirmar:
 * el encargado mira la captura y los aprueba o rechaza. Debajo, todo lo que se subió hoy con lo que
 * leyó SARA, para cruzarlo con los movimientos de la cuenta de Bancolombia.
 */
export const ComprobantesSection = () => {
  const resumen = useResumenComprobantes();
  const porRevisar = useComprobantes('en_revision');
  const deHoy = useComprobantes('todos');
  const aprobar = useAprobarComprobante();
  const rechazar = useRechazarComprobante();
  const [accion, setAccion] = useState<{ comprobante: ComprobantePago; tipo: 'aprobar' | 'rechazar' } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);

  const abrir = (tipo: 'aprobar' | 'rechazar') => (comprobante: ComprobantePago) => {
    aprobar.reset();
    rechazar.reset();
    setMotivo('');
    setErrorMotivo(null);
    setAccion({ comprobante, tipo });
  };

  const confirmar = () => {
    if (!accion) return;
    const { comprobante, tipo } = accion;
    if (tipo === 'rechazar') {
      if (motivo.trim().length < 3) {
        setErrorMotivo('Escribe el motivo del rechazo (mínimo 3 caracteres)');
        return;
      }
      rechazar.mutate(
        { id: comprobante.id, motivo: motivo.trim() },
        {
          onSuccess: () => {
            setAccion(null);
            toast.success(`Comprobante de ${comprobante.persona.nombre} rechazado: tiene 15 minutos para subir otro`);
          },
        }
      );
    } else {
      aprobar.mutate(
        { id: comprobante.id },
        {
          onSuccess: () => {
            setAccion(null);
            toast.success(`Pago de ${comprobante.persona.nombre} aprobado: su almuerzo quedó pagado`);
          },
        }
      );
    }
  };

  const enRevision = resumen.data?.en_revision ?? 0;
  const mutacion = accion?.tipo === 'rechazar' ? rechazar : aprobar;

  return (
    <div className="flex flex-col gap-6">
      <FranjaCifras
        etiqueta="Resumen de pagos con QR"
        destacada
        cifras={[
          {
            etiqueta: 'Por revisar',
            valor: resumen.data?.en_revision,
            detalle: 'Comprobantes que el lector no pudo confirmar',
            estado: resumen.data && enRevision > 0 ? { texto: 'Pendiente', color: 'warning' } : undefined,
          },
          {
            etiqueta: 'Confirmados hoy',
            valor: resumen.data?.aceptados_hoy,
            detalle: resumen.data ? `${pesos(resumen.data.valor_aceptado_hoy)} pagados con QR` : undefined,
          },
          { etiqueta: 'No aceptados hoy', valor: resumen.data?.rechazados_hoy, detalle: 'Otro día, otro valor o repetidos' },
        ]}
      />

      <SectionCard
        principal
        titulo="Comprobantes por revisar"
        descripcion="Mira la captura, compárala con lo que leyó SARA y decide"
      >
        {porRevisar.isPending ? (
          <ListSkeleton label="Cargando comprobantes por revisar..." filas={2} />
        ) : porRevisar.isError ? (
          <ErrorAlert error={porRevisar.error} titulo="No se pudieron cargar los comprobantes" onReintentar={() => porRevisar.refetch()} />
        ) : porRevisar.data.length === 0 ? (
          <EmptyMessage icon={<BadgeCheck className="size-8" />}>No hay comprobantes por revisar</EmptyMessage>
        ) : (
          <div className="flex flex-col gap-3">
            {porRevisar.data.map((c) => (
              <ComprobanteRevisionItem key={c.id} comprobante={c} onAprobar={abrir('aprobar')} onRechazar={abrir('rechazar')} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard titulo="Comprobantes de hoy" descripcion="Todo lo que se subió hoy, con lo que leyó SARA">
        {deHoy.isPending ? (
          <ListSkeleton label="Cargando comprobantes de hoy..." forma="tabla" />
        ) : deHoy.isError ? (
          <ErrorAlert error={deHoy.error} titulo="No se pudieron cargar los comprobantes de hoy" onReintentar={() => deHoy.refetch()} />
        ) : deHoy.data.length === 0 ? (
          <EmptyMessage>Hoy nadie ha subido comprobantes</EmptyMessage>
        ) : (
          <ul className="divide-y divide-separator" aria-label="Comprobantes de hoy">
            {deHoy.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {c.persona.nombre}
                    <span className="ml-2 text-xs font-normal text-muted">{hora(c.subido_en)}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {[c.banco ?? 'Banco sin leer', c.valor !== null ? pesos(c.valor) : null, c.numero ? `Comprobante ${c.numero}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {c.estado === 'rechazado' && c.motivo && <p className="mt-0.5 text-xs text-muted">{c.motivo}</p>}
                  {c.revisado_por && <p className="mt-0.5 text-xs text-muted">Revisado por {c.revisado_por}</p>}
                </div>
                <Chip size="sm" variant="soft" color={ESTADO[c.estado].color}>
                  {ESTADO[c.estado].texto}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {accion && (
        <ConfirmDialog
          abierto
          titulo={accion.tipo === 'aprobar' ? 'Aprobar pago' : 'Rechazar comprobante'}
          icono={accion.tipo === 'aprobar' ? <BadgeCheck className="size-5" /> : <CircleX className="size-5" />}
          textoConfirmar={accion.tipo === 'aprobar' ? `Aprobar ${pesos(accion.comprobante.reserva.precio)}` : 'Rechazar'}
          variante={accion.tipo === 'aprobar' ? 'accent' : 'danger'}
          cargando={mutacion.isPending}
          onConfirmar={confirmar}
          onCancelar={() => setAccion(null)}
        >
          <div className="flex flex-col gap-3">
            {accion.tipo === 'aprobar' ? (
              <p>
                El almuerzo de {accion.comprobante.persona.nombre} queda pagado. Hazlo solo si el pago aparece en la cuenta o
                la captura no deja dudas.
              </p>
            ) : (
              <>
                <p>
                  {accion.comprobante.persona.nombre} verá el motivo y tendrá 15 minutos para subir otro comprobante. Si no lo
                  hace, la reserva se anula.
                </p>
                <TextAreaField
                  id="motivo-rechazo-comprobante"
                  label="Motivo"
                  required
                  rows={3}
                  maxLength={300}
                  value={motivo}
                  error={errorMotivo ?? undefined}
                  onChange={(e) => {
                    setMotivo(e.target.value);
                    setErrorMotivo(null);
                  }}
                  placeholder="La captura está cortada y no se ve el número del comprobante"
                />
              </>
            )}
            {mutacion.isError && <ErrorAlert error={mutacion.error} titulo="No se pudo guardar la revisión" />}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
};
