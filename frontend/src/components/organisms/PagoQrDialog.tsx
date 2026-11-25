import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Chip, Modal, toast } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, ImageUp, Timer } from 'lucide-react';
import { Button } from '../atoms/Button';
import { FieldMessage } from '../atoms/FieldMessage';
import { asset } from '../../lib/assets';
import { mensajeDeError } from '../../lib/api';
import { pesos } from '../../lib/formato';
import { queryKeys } from '../../hooks/queryKeys';
import { useCancelarReserva, useSubirComprobante } from '../../hooks/usePagoQr';
import type { EstadoComprobante } from '../../types/api';

/** La reserva que se está pagando: la que se acaba de crear o la que el menú muestra pendiente. */
export interface ReservaPorPagar {
  id: string;
  precio: number;
  /** Hasta cuándo está apartada la porción; null si ya no vence (en revisión). */
  vence_en: string | null;
  comprobante?: { estado: EstadoComprobante; motivo: string | null } | null;
}

interface PagoQrDialogProps {
  reserva: ReservaPorPagar | null;
  onCerrar: () => void;
}

interface Mensaje {
  id: number;
  de: 'sara' | 'persona';
  texto?: ReactNode;
  /** Vista previa de la captura que subió la persona. */
  imagen?: string;
  /** Resultado de la lectura, para la etiqueta de la burbuja. */
  estado?: EstadoComprobante;
  /** La burbuja con el código QR. */
  qr?: boolean;
}

const TIPOS = ['image/png', 'image/jpeg', 'image/webp'];
const TAMANO_MAXIMO = 5 * 1024 * 1024;
const QR = '/pago-qr-bancolombia.jpg';

const ETIQUETA: Record<EstadoComprobante, { texto: string; color: 'success' | 'warning' | 'danger' }> = {
  aceptado: { texto: 'Pago confirmado', color: 'success' },
  en_revision: { texto: 'En revisión', color: 'warning' },
  rechazado: { texto: 'No se aceptó', color: 'danger' },
};

const minutosSegundos = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

let siguienteId = 0;
const mensaje = (m: Omit<Mensaje, 'id'>): Mensaje => ({ ...m, id: (siguienteId += 1) });

/** Lo que SARA dice al abrir, según cómo va el pago de la reserva. */
const mensajesIniciales = (reserva: ReservaPorPagar): Mensaje[] => {
  if (reserva.comprobante?.estado === 'en_revision') {
    return [
      mensaje({
        de: 'sara',
        estado: 'en_revision',
        texto: 'Tu comprobante está en revisión del encargado. Tu almuerzo sigue apartado: aquí verás la respuesta.',
      }),
    ];
  }
  const inicio = [
    mensaje({ de: 'sara', qr: true }),
    mensaje({
      de: 'sara',
      texto: 'Cuando termines, sube aquí la captura de pantalla del comprobante. La reviso al instante.',
    }),
  ];
  if (reserva.comprobante?.estado === 'rechazado') {
    inicio.push(
      mensaje({ de: 'sara', estado: 'rechazado', texto: `${reserva.comprobante.motivo ?? 'Tu comprobante no se aceptó.'} Sube otro.` })
    );
  }
  return inicio;
};

/**
 * Pago del almuerzo con el código QR de Bancolombia (ADR 027), como un chat con SARA: muestra el
 * código, cuánto tiempo queda apartada la porción y recibe la captura del comprobante. El backend
 * la lee con OCR y responde si el pago quedó confirmado, en revisión del encargado o no se aceptó.
 */
export const PagoQrDialog = ({ reserva, onCerrar }: PagoQrDialogProps) => {
  const queryClient = useQueryClient();
  const subir = useSubirComprobante();
  const cancelar = useCancelarReserva();
  const archivoRef = useRef<HTMLInputElement>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const vistas = useRef<string[]>([]);

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [venceEn, setVenceEn] = useState<string | null>(null);
  const [final, setFinal] = useState<'pagado' | 'revision' | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  // Cada vez que se abre para una reserva, la conversación arranca de su estado actual
  useEffect(() => {
    if (!reserva) return;
    setMensajes(mensajesIniciales(reserva));
    setVenceEn(reserva.vence_en);
    setFinal(reserva.comprobante?.estado === 'en_revision' ? 'revision' : null);
    setErrorArchivo(null);
    subir.reset();
    cancelar.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de reserva
  }, [reserva?.id]);

  // Reloj de la porción apartada
  useEffect(() => {
    if (!reserva || !venceEn || final) return;
    setAhora(Date.now());
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(intervalo);
  }, [reserva, venceEn, final]);

  useEffect(() => {
    finRef.current?.scrollIntoView?.({ block: 'end' });
  }, [mensajes, subir.isPending]);

  // Las vistas previas ocupan memoria hasta que se liberan
  useEffect(() => () => vistas.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const restante = venceEn ? Math.max(0, new Date(venceEn).getTime() - ahora) : null;
  const vencida = restante === 0 && !final;

  useEffect(() => {
    if (vencida) {
      queryClient.invalidateQueries({ queryKey: queryKeys.menuActivo });
      queryClient.invalidateQueries({ queryKey: queryKeys.consumos });
    }
  }, [vencida, queryClient]);

  if (!reserva) return null;

  const agregar = (...nuevos: Omit<Mensaje, 'id'>[]) => setMensajes((actuales) => [...actuales, ...nuevos.map(mensaje)]);

  const elegirArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) {
      setErrorArchivo('Sube una imagen PNG, JPG o WEBP: la captura de pantalla del comprobante.');
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      setErrorArchivo('La imagen pesa más de 5 MB. Sube la captura de pantalla, no una foto de la pantalla.');
      return;
    }
    setErrorArchivo(null);
    const vista = URL.createObjectURL(archivo);
    vistas.current.push(vista);
    agregar({ de: 'persona', imagen: vista });

    subir.mutate(
      { ventaId: reserva.id, archivo },
      {
        onSuccess: (r) => {
          if (r.estado === 'aceptado') {
            agregar({ de: 'sara', estado: 'aceptado', texto: `${r.motivo} Presenta tu documento al reclamar el almuerzo.` });
            setFinal('pagado');
            setVenceEn(null);
            toast.success('Pago confirmado: tu almuerzo quedó reservado');
          } else if (r.estado === 'en_revision') {
            agregar({ de: 'sara', estado: 'en_revision', texto: r.motivo });
            setFinal('revision');
            setVenceEn(null);
          } else {
            agregar({ de: 'sara', estado: 'rechazado', texto: `${r.motivo} Sube otra captura.` });
            setVenceEn(r.reserva.vence_en);
          }
        },
        onError: (error) => agregar({ de: 'sara', estado: 'rechazado', texto: mensajeDeError(error) }),
      }
    );
  };

  const cancelarReserva = () =>
    cancelar.mutate(reserva.id, {
      onSuccess: () => {
        toast.success('Cancelaste tu reserva: la porción quedó libre');
        onCerrar();
      },
      onError: (error) => agregar({ de: 'sara', texto: mensajeDeError(error) }),
    });

  const puedeSubir = !final && !vencida;

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(abrir) => {
        if (!abrir && !subir.isPending) onCerrar();
      }}
    >
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog aria-label="Pagar el almuerzo con el código QR">
          <Modal.CloseTrigger aria-label="Cerrar" />
          <Modal.Header className="gap-2">
            <Modal.Heading>Paga tu almuerzo</Modal.Heading>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">
                Valor <span className="font-semibold tabular-nums text-foreground">{pesos(reserva.precio)}</span>
              </span>
              {restante !== null && !final && (
                <Chip size="sm" variant="soft" color={restante < 3 * 60_000 ? 'danger' : 'warning'}>
                  <Timer className="size-3.5" />
                  <Chip.Label>{vencida ? 'Tiempo agotado' : `Apartado ${minutosSegundos(restante)}`}</Chip.Label>
                </Chip>
              )}
            </div>
          </Modal.Header>

          <Modal.Body>
            <div role="log" aria-live="polite" aria-label="Conversación del pago" className="flex flex-col gap-3 py-1">
              {mensajes.map((m) => (
                <Burbuja key={m.id} mensaje={m} precio={reserva.precio} />
              ))}
              {subir.isPending && (
                <Burbuja mensaje={{ id: 0, de: 'sara', texto: 'Leyendo tu comprobante…' }} precio={reserva.precio} estado="status" />
              )}
              {vencida && (
                <Burbuja
                  mensaje={{
                    id: -1,
                    de: 'sara',
                    texto: 'Se acabó el tiempo y tu porción quedó libre. Si quedan almuerzos, puedes solicitarlo de nuevo.',
                  }}
                  precio={reserva.precio}
                />
              )}
              <div ref={finRef} />
            </div>
            {errorArchivo && <FieldMessage id="error-comprobante">{errorArchivo}</FieldMessage>}
          </Modal.Body>

          <Modal.Footer className="flex-wrap justify-between gap-2">
            {puedeSubir ? (
              <>
                <Button
                  variant="ghost"
                  className="text-danger-soft-foreground"
                  onPress={cancelarReserva}
                  isPending={cancelar.isPending}
                  isDisabled={subir.isPending}
                >
                  Cancelar reserva
                </Button>
                <input
                  ref={archivoRef}
                  type="file"
                  accept={TIPOS.join(',')}
                  className="hidden"
                  aria-label="Captura del comprobante"
                  aria-describedby={errorArchivo ? 'error-comprobante' : undefined}
                  onChange={elegirArchivo}
                />
                <Button onPress={() => archivoRef.current?.click()} isPending={subir.isPending}>
                  {!subir.isPending && <ImageUp />}
                  Subir comprobante
                </Button>
              </>
            ) : (
              <Button className="ml-auto" onPress={onCerrar}>
                {final === 'pagado' ? 'Listo' : 'Cerrar'}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

/** Una burbuja de la conversación: SARA a la izquierda, la persona a la derecha. */
const Burbuja = ({ mensaje: m, precio, estado }: { mensaje: Mensaje; precio: number; estado?: 'status' }) => {
  if (m.de === 'persona') {
    return (
      <div className="max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-accent-soft p-1.5">
        {m.imagen && <img src={m.imagen} alt="Tu comprobante" className="max-h-52 rounded-xl object-contain" />}
      </div>
    );
  }
  return (
    <div className="flex max-w-[90%] items-start gap-2 self-start" role={estado}>
      <img src={asset('/sara-icono.svg')} alt="" className="mt-0.5 size-6 shrink-0" />
      <div className="flex flex-col gap-2 rounded-2xl rounded-tl-sm bg-surface-secondary px-3.5 py-2.5 text-sm text-foreground">
        {m.estado && (
          <Chip size="sm" variant="soft" color={ETIQUETA[m.estado].color} className="self-start">
            {ETIQUETA[m.estado].texto}
          </Chip>
        )}
        {m.qr ? (
          <>
            <p>
              Paga <span className="font-semibold tabular-nums">{pesos(precio)}</span> con este código QR desde la app de tu
              banco o de Nequi.
            </p>
            <img
              src={asset(QR)}
              alt="Código QR de Bancolombia para pagar en el comedor"
              className="w-56 max-w-full self-center rounded-xl bg-white"
            />
            <a
              href={asset(QR)}
              download="codigo-qr-almuerzo-sara.jpg"
              className="inline-flex items-center gap-1.5 self-start font-medium text-accent hover:underline"
            >
              <Download className="size-4" />
              Descargar el código
            </a>
            <p className="text-xs text-muted">Si estás en el celular, descárgalo y ábrelo desde la galería en la app de tu banco</p>
          </>
        ) : (
          <p>{m.texto}</p>
        )}
      </div>
    </div>
  );
};
