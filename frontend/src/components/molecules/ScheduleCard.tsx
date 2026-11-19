import { Card } from '@heroui/react';
import { Clock } from 'lucide-react';

export interface ScheduleCardProps {
  scheduleText?: string;
}

export const ScheduleCard = ({ scheduleText = 'Lunes a viernes: 7:00 a. m. – 6:00 p. m.' }: ScheduleCardProps) => (
  <Card>
    <Card.Header className="flex-row items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <Clock className="size-5" />
      </div>
      <div>
        <Card.Title>Horario de atención</Card.Title>
        <Card.Description>{scheduleText}</Card.Description>
      </div>
    </Card.Header>
  </Card>
);
