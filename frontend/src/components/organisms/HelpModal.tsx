import { Mail, Phone } from 'lucide-react';
import { Accordion, Alert, Button, Modal } from '@heroui/react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PREGUNTAS = [
  {
    id: 'ingreso',
    titulo: '¿Cómo ingreso?',
    texto:
      'Escribe tu número de documento sin puntos ni espacios y tu contraseña. No necesitas elegir si eres aprendiz, instructor o encargado.',
  },
  {
    id: 'registro',
    titulo: '¿Aún no tienes cuenta?',
    texto:
      'Presiona "Registrarse" debajo del formulario. Los aprendices se registran con su número de ficha; los instructores envían una solicitud que la coordinación aprueba.',
  },
  {
    id: 'clave',
    titulo: '¿Olvidaste tus credenciales?',
    texto:
      'Comunícate con la coordinación académica o acércate a la oficina de bienestar al aprendiz para restablecer tus datos de acceso.',
  },
];

export const HelpModal = ({ isOpen, onClose }: HelpModalProps) => (
  <Modal.Backdrop
    isOpen={isOpen}
    onOpenChange={(abierto) => {
      if (!abierto) onClose();
    }}
  >
    <Modal.Container size="md" scroll="inside">
      <Modal.Dialog>
        <Modal.CloseTrigger aria-label="Cerrar ayuda" />
        <Modal.Header>
          <Modal.Heading>Centro de ayuda</Modal.Heading>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-4">
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Acceso institucional</Alert.Title>
              <Alert.Description>
                El sistema reconoce tu tipo de cuenta y te lleva directo a tu panel.
              </Alert.Description>
            </Alert.Content>
          </Alert>

          <Accordion variant="surface">
            {PREGUNTAS.map((p) => (
              <Accordion.Item key={p.id} id={p.id}>
                <Accordion.Heading>
                  <Accordion.Trigger>
                    {p.titulo}
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="text-sm text-muted">{p.texto}</Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>

          <div className="grid gap-2 text-sm text-muted sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <Phone className="size-4" /> Ext. 1234 · Cafetería
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-4" /> gastrosena@sena.edu.co
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button slot="close" variant="secondary">
            Entendido
          </Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
);
