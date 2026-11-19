import { Alert } from '@heroui/react';

/** Aviso de éxito de una acción; se usa con el hook useAviso, que lo oculta a los 5 segundos. */
export const AvisoExito = ({ aviso }: { aviso: string | null }) =>
  aviso ? (
    <Alert status="success" role="status">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{aviso}</Alert.Description>
      </Alert.Content>
    </Alert>
  ) : null;
