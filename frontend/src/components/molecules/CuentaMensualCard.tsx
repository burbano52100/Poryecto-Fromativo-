import { Button, Card } from '@heroui/react';
import { ArrowRight, CreditCard } from 'lucide-react';
import { pesos } from '../../lib/formato';

export interface CuentaMensualCardProps {
  pendingBalance: number;
  onViewAccount?: () => void;
}

export const CuentaMensualCard = ({ pendingBalance, onViewAccount }: CuentaMensualCardProps) => (
  <Card>
    <Card.Header className="flex-row items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-soft-foreground">
        <CreditCard className="size-5" />
      </div>
      <div>
        <Card.Title>Cuenta mensual</Card.Title>
        <Card.Description>Como instructor, consumes almuerzos y pagas a fin de mes.</Card.Description>
      </div>
    </Card.Header>
    <Card.Footer className="justify-between">
      <p className="text-sm text-muted">
        Saldo actual: <span className="font-semibold tabular-nums text-foreground">{pesos(pendingBalance)}</span>
      </p>
      {onViewAccount && (
        <Button size="sm" variant="secondary" onPress={onViewAccount}>
          Ver cuenta <ArrowRight />
        </Button>
      )}
    </Card.Footer>
  </Card>
);
