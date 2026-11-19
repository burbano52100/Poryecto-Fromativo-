import type { ReactNode } from 'react';
import { Modal } from '@heroui/react';

interface FormModalProps {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  descripcion?: ReactNode;
  ancho?: 'md' | 'lg';
}

/** Modal de HeroUI para formularios (Escape, el fondo o la X lo cierran). */
export const FormModal = ({ abierto, titulo, onCerrar, children, descripcion, ancho = 'md' }: FormModalProps) => (
  <Modal.Backdrop
    isOpen={abierto}
    onOpenChange={(abrir) => {
      if (!abrir) onCerrar();
    }}
  >
    <Modal.Container size={ancho === 'lg' ? 'lg' : 'md'} scroll="inside">
      <Modal.Dialog>
        <Modal.CloseTrigger aria-label="Cerrar" />
        <Modal.Header>
          <Modal.Heading>{titulo}</Modal.Heading>
          {descripcion && <p className="text-sm text-muted">{descripcion}</p>}
        </Modal.Header>
        <Modal.Body>{children}</Modal.Body>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
);
