import { Alert, Card, Chip } from '@heroui/react';
import { pesos } from '../../lib/formato';
import { SectionCard } from '../molecules/SectionCard';

export interface MiCuentaSectionProps {
  totalConsumed: number;
  pendingBalance: number;
  paymentMethod: string;
  paymentFrequency: string;
  nextCutoffDate: string;
}

export const MiCuentaSection = ({
  totalConsumed,
  pendingBalance,
  paymentMethod,
  paymentFrequency,
  nextCutoffDate,
}: MiCuentaSectionProps) => {
  const tienePendiente = pendingBalance > 0;

  return (
    <SectionCard titulo="Resumen de cuenta mensual" descripcion="Estado de tu cuenta y pagos pendientes">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card variant="secondary">
          <Card.Header>
            <Card.Description>Total consumido</Card.Description>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{pesos(totalConsumed)}</p>
          </Card.Header>
          <Card.Footer className="text-xs text-muted">Acumulado del mes</Card.Footer>
        </Card>

        <Card variant="secondary">
          <Card.Header>
            <Card.Description>Saldo actual</Card.Description>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{pesos(pendingBalance)}</p>
          </Card.Header>
          <Card.Footer>
            <Chip size="sm" variant="soft" color={tienePendiente ? 'warning' : 'success'}>
              {tienePendiente ? 'Pago pendiente' : 'Cuenta al día'}
            </Chip>
          </Card.Footer>
        </Card>
      </div>

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">Método de pago</dt>
          <dd className="font-medium text-foreground">{paymentMethod}</dd>
        </div>
        <div>
          <dt className="text-muted">Frecuencia</dt>
          <dd className="font-medium text-foreground">{paymentFrequency}</dd>
        </div>
        <div>
          <dt className="text-muted">Próximo corte</dt>
          <dd className="font-medium text-foreground">{nextCutoffDate}</dd>
        </div>
      </dl>

      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            Contacta al encargado para hacer tu pago o pedir un estado de cuenta detallado.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </SectionCard>
  );
};
