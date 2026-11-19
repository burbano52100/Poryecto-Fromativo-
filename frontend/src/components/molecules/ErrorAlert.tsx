import { Alert, Button, CloseButton } from '@heroui/react';
import { RotateCw } from 'lucide-react';
import { mensajeDeError } from '../../lib/api';

interface ErrorAlertProps {
  error: unknown;
  titulo?: string;
  onReintentar?: () => void;
  onCerrar?: () => void;
}

/** Aviso de error de la API con el mensaje del backend y, opcionalmente, reintentar. */
export const ErrorAlert = ({ error, titulo = 'No se pudo completar la operación', onReintentar, onCerrar }: ErrorAlertProps) => (
  <Alert status="danger" role="alert">
    <Alert.Indicator />
    <Alert.Content>
      <Alert.Title>{titulo}</Alert.Title>
      <Alert.Description>{mensajeDeError(error)}</Alert.Description>
    </Alert.Content>
    {onReintentar && (
      <Button size="sm" variant="danger-soft" onPress={onReintentar}>
        <RotateCw /> Reintentar
      </Button>
    )}
    {onCerrar && <CloseButton aria-label="Cerrar aviso" onPress={onCerrar} />}
  </Alert>
);
