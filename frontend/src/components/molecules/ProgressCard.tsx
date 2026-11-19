import { Card } from '@heroui/react';
import { TrendingUp } from 'lucide-react';

export interface ProgressCardProps {
  consumedLunches?: number;
  message?: string;
}

export const ProgressCard = ({
  consumedLunches = 5,
  message = 'Mantén una alimentación balanceada.',
}: ProgressCardProps) => (
  <Card>
    <Card.Header className="flex-row items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-soft-foreground">
        <TrendingUp className="size-5" />
      </div>
      <div>
        <Card.Title>Tu progreso</Card.Title>
        <Card.Description>
          Has usado <span className="font-semibold text-foreground">{consumedLunches} fichas</span> este mes. {message}
        </Card.Description>
      </div>
    </Card.Header>
  </Card>
);
