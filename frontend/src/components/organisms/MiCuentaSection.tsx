import { Alert } from '@heroui/react';
import { pesos } from '../../lib/formato';
import { SectionCard } from '../molecules/SectionCard';

export interface MiCuentaSectionProps {
  totalConsumed: number;
  paymentMethod: string;
  paymentFrequency: string;
  nextCutoffDate: string;
}

export const MiCuentaSection = ({
  totalConsumed,
  paymentMethod,
  paymentFrequency,
  nextCutoffDate,
}: MiCuentaSectionProps) => {
  return (
    <SectionCard titulo="Resumen de cuenta mensual" descripcion="Estado de tu cuenta y pagos pendientes">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Consumido este mes</dt>
          <dd className="font-medium tabular-nums text-foreground">{pesos(totalConsumed)}</dd>
        </div>
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
