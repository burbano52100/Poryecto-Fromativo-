import { useState } from 'react';
import { CheckCircle2, MessageSquareReply } from 'lucide-react';
import { Card, Chip, toast } from '@heroui/react';
import { Button } from '../atoms/Button';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SectionCard } from '../molecules/SectionCard';
import { TextAreaField } from '../molecules/TextAreaField';
import { useResponderSugerencia, useSugerencias } from '../../hooks/useSugerencias';
import type { Sugerencia } from '../../types/api';

/** Buzón de gestión: recibe las sugerencias de aprendices e instructores. */
export const BuzonSugerenciasEncargadoSection = () => {
  const { data: sugerencias = [], isPending, isError, error, refetch } = useSugerencias();
  const responder = useResponderSugerencia();
  const [sugerenciaAResponder, setSugerenciaAResponder] = useState<Sugerencia | null>(null);
  const [respuesta, setRespuesta] = useState('');

  const abrirRespuesta = (sugerencia: Sugerencia) => {
    responder.reset();
    setRespuesta('');
    setSugerenciaAResponder(sugerencia);
  };

  const confirmarRespuesta = () => {
    if (!sugerenciaAResponder) return;
    const { id, subject } = sugerenciaAResponder;
    responder.mutate(
      { id, respuesta: respuesta.trim() || undefined },
      {
        onSuccess: () => {
          setSugerenciaAResponder(null);
          toast.success(`La sugerencia "${subject}" fue marcada como atendida.`);
        },
      }
    );
  };

  const totalCount = sugerencias.length;
  const attendedCount = sugerencias.filter((s) => s.status === 'ATENDIDA').length;
  const pendingCount = totalCount - attendedCount;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        titulo="Sugerencias y comentarios"
        descripcion="Mensajes enviados por aprendices e instructores"
        acciones={
          <>
            <Chip variant="soft">{totalCount} recibidas</Chip>
            <Chip variant="soft" color="success">
              {attendedCount} Atendidas
            </Chip>
            <Chip variant="soft" color="warning">
              {pendingCount} Pendientes
            </Chip>
          </>
        }
      >

        {isPending ? (
          <ListSkeleton label="Cargando sugerencias..." />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar las sugerencias" onReintentar={() => refetch()} />
        ) : sugerencias.length === 0 ? (
          <EmptyMessage>Aún no hay sugerencias en el buzón.</EmptyMessage>
        ) : (
          <div className="flex flex-col gap-3">
            {sugerencias.map((item) => {
              const pendiente = item.status === 'PENDIENTE';
              return (
                <Card key={item.id} variant="secondary">
                  <Card.Header className="flex-row flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Chip size="sm" variant="soft" color={pendiente ? 'warning' : 'success'}>
                        {pendiente ? 'Pendiente' : 'Atendida'}
                      </Chip>
                      <Card.Title>{item.subject}</Card.Title>
                    </div>
                    <span className="text-xs text-muted">{item.date}</span>
                  </Card.Header>

                  <Card.Content className="gap-2">
                    <p className="text-sm text-foreground">{item.message}</p>
                    {item.respuesta && (
                      <p className="border-t border-separator pt-2 text-sm text-muted">
                        <span className="font-medium text-foreground">Tu respuesta:</span> {item.respuesta}
                      </p>
                    )}
                  </Card.Content>

                  <Card.Footer className="flex-wrap justify-between gap-3 text-xs text-muted">
                    <span>
                      <span className="font-medium text-foreground">{item.author}</span> · {item.role} · {item.fichaOrDoc}
                    </span>
                    {pendiente && (
                      <Button size="sm" onPress={() => abrirRespuesta(item)}>
                        <CheckCircle2 />
                        Responder y marcar atendida
                      </Button>
                    )}
                  </Card.Footer>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        abierto={sugerenciaAResponder !== null}
        titulo="Responder sugerencia"
        icono={<MessageSquareReply className="size-5" />}
        textoConfirmar="Marcar como atendida"
        onConfirmar={confirmarRespuesta}
        onCancelar={() => setSugerenciaAResponder(null)}
        cargando={responder.isPending}
      >
        {sugerenciaAResponder && (
          <div className="flex flex-col gap-3">
            <p className="font-medium text-foreground">{sugerenciaAResponder.subject}</p>
            <TextAreaField
              id="respuesta-sugerencia"
              label={`Respuesta para ${sugerenciaAResponder.author} (opcional)`}
              rows={4}
              maxLength={1000}
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              placeholder="Gracias por tu sugerencia. Ya lo revisamos con el equipo de cocina."
            />
            {responder.isError && <ErrorAlert error={responder.error} titulo="No se pudo guardar la respuesta" />}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};
