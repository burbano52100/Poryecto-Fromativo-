import type { ReactNode } from 'react';
import { AlertDialog } from '@heroui/react';
import { Button } from '../atoms/Button';

type Variante = 'accent' | 'danger' | 'warning';

interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  icono?: ReactNode;
  children: ReactNode;
  textoConfirmar: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  cargando?: boolean;
  variante?: Variante;
}

/** Confirmación con AlertDialog de HeroUI. Mientras `cargando`, no se puede cerrar. */
export const ConfirmDialog = ({
  abierto,
  titulo,
  icono,
  children,
  textoConfirmar,
  onConfirmar,
  onCancelar,
  cargando = false,
  variante = 'accent',
}: ConfirmDialogProps) => (
  <AlertDialog.Backdrop
    isOpen={abierto}
    onOpenChange={(abrir) => {
      if (!abrir && !cargando) onCancelar();
    }}
    isKeyboardDismissDisabled={cargando}
  >
    <AlertDialog.Container size="sm">
      <AlertDialog.Dialog>
        <AlertDialog.Header>
          <AlertDialog.Icon status={variante}>{icono}</AlertDialog.Icon>
          <AlertDialog.Heading>{titulo}</AlertDialog.Heading>
        </AlertDialog.Header>
        <AlertDialog.Body className="text-sm text-muted">{children}</AlertDialog.Body>
        <AlertDialog.Footer>
          <Button variant="tertiary" onPress={onCancelar} isDisabled={cargando}>
            Cancelar
          </Button>
          <Button variant={variante === 'danger' ? 'danger' : 'primary'} onPress={onConfirmar} isPending={cargando}>
            {textoConfirmar}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Dialog>
    </AlertDialog.Container>
  </AlertDialog.Backdrop>
);
