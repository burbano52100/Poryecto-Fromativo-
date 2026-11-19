import type { ReactNode } from 'react';
import { Card } from '@heroui/react';

interface SectionCardProps {
  titulo: ReactNode;
  descripcion?: ReactNode;
  /** Botones o chips a la derecha del título. */
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Contenedor estándar de cada sección del panel: Card de HeroUI con título, descripción y acciones. */
export const SectionCard = ({ titulo, descripcion, acciones, children, className = '' }: SectionCardProps) => (
  <Card className={`gap-5 p-5 sm:p-6 ${className}`}>
    <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Card.Title className="text-base font-semibold">{titulo}</Card.Title>
        {descripcion && <Card.Description>{descripcion}</Card.Description>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </Card.Header>
    <Card.Content className="gap-4">{children}</Card.Content>
  </Card>
);
