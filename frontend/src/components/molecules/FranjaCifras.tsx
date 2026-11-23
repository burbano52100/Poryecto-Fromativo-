import type { ReactNode } from 'react';
import { Button, Card, Chip, Skeleton } from '@heroui/react';

export interface Cifra {
  /** Qué se cuenta, con las palabras de quien lo lee. */
  etiqueta: string;
  /** `undefined` mientras carga: se muestra un Skeleton. */
  valor: ReactNode | undefined;
  /** Una línea de contexto: el desglose del número o qué significa. */
  detalle?: ReactNode;
  /** Estado que pide atención (saldo pendiente, cuenta al día). */
  estado?: { texto: string; color: 'warning' | 'danger' | 'success' };
  /** Lleva a la sección donde se actúa sobre el número. */
  accion?: { texto: string; onPress: () => void };
}

interface FranjaCifrasProps {
  /** Nombre del resumen para lectores de pantalla. */
  etiqueta: string;
  cifras: Cifra[];
  /** Sin Card propia, para ponerla dentro de una SectionCard que ya tiene borde. */
  sinTarjeta?: boolean;
  /** Clases del contenedor exterior (la Card, o la lista si va sin tarjeta). */
  className?: string;
}

/**
 * Las cifras de un panel o una sección en una sola superficie, separadas por líneas finas:
 * etiqueta, número y una línea de contexto. Reemplaza la fila de tarjetas idénticas con un ícono
 * en la esquina, que daba el mismo peso a todo. Sin íconos decorativos; el color solo aparece en
 * el Chip de estado, cuando el número pide hacer algo.
 *
 * Se pone en una sola fila según el ancho del contenedor (container queries), no de la ventana:
 * con la barra lateral abierta, cuatro cifras necesitan más espacio que dos.
 */
const FILA = {
  pocas: '@lg:flex @lg:gap-0 @lg:divide-x @lg:divide-separator',
  muchas: '@2xl:flex @2xl:gap-0 @2xl:divide-x @2xl:divide-separator',
};
const CELDA = {
  pocas: '@lg:flex-1 @lg:px-5 @lg:first:pl-0 @lg:last:pr-0',
  muchas: '@2xl:flex-1 @2xl:px-5 @2xl:first:pl-0 @2xl:last:pr-0',
};

export const FranjaCifras = ({ etiqueta, cifras, sinTarjeta = false, className = '' }: FranjaCifrasProps) => {
  const ancho = cifras.length >= 4 ? 'muchas' : 'pocas';
  const lista = (
    <dl aria-label={etiqueta} className={`grid grid-cols-2 gap-x-4 gap-y-5 ${FILA[ancho]}`}>
      {cifras.map((cifra) => (
        <div key={cifra.etiqueta} className={`flex min-w-0 flex-col gap-1 ${CELDA[ancho]}`}>
          <dt className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {cifra.etiqueta}
            {cifra.estado && (
              <Chip size="sm" variant="soft" color={cifra.estado.color}>
                {cifra.estado.texto}
              </Chip>
            )}
          </dt>
          <dd className="text-2xl font-semibold tabular-nums text-foreground">
            {cifra.valor === undefined ? <Skeleton className="mt-1 h-7 w-24 rounded-md" /> : cifra.valor}
          </dd>
          {cifra.detalle && <dd className="text-xs text-muted">{cifra.detalle}</dd>}
          {cifra.accion && (
            <dd className="mt-1">
              <Button size="sm" variant="secondary" onPress={cifra.accion.onPress}>
                {cifra.accion.texto}
              </Button>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );

  return sinTarjeta ? (
    <div className={`@container ${className}`}>{lista}</div>
  ) : (
    <Card className={`@container p-5 ${className}`}>{lista}</Card>
  );
};
