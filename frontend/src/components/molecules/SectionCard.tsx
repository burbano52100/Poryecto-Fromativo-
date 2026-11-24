import type { ReactNode } from 'react';
import { Card } from '@heroui/react';

interface SectionCardProps {
  titulo: ReactNode;
  descripcion?: ReactNode;
  /** Botones o chips a la derecha del título. */
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * La tarea principal de la sección (publicar el menú, registrar una visita): fondo y borde en
   * el color del perfil para que sea lo primero que se mira. Una sola por sección.
   */
  principal?: boolean;
}

/** Contenedor estándar de cada sección del panel: Card de HeroUI con título, descripción y acciones. */
export const SectionCard = ({ titulo, descripcion, acciones, children, className = '', principal = false }: SectionCardProps) => (
  <Card className={`gap-5 p-5 sm:p-6 ${principal ? 'border border-accent/30 bg-accent-soft' : ''} ${className}`}>
    <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Card.Title className={principal ? 'text-lg font-semibold text-accent-soft-foreground' : 'text-base font-semibold'}>
          {titulo}
        </Card.Title>
        {descripcion && <Card.Description className={principal ? 'text-foreground/80' : undefined}>{descripcion}</Card.Description>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </Card.Header>
    <Card.Content className="gap-4">{children}</Card.Content>
  </Card>
);
