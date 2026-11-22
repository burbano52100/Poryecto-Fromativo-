import { Card } from '@heroui/react';
import { Clock } from 'lucide-react';

export interface ScheduleCardProps {
  scheduleText?: string;
}

export const ScheduleCard = ({ scheduleText = 'Reservas: 7:00 a. m. a 9:00 p. m. (hora de Colombia)' }: ScheduleCardProps) => (
  <Card>
    <Card.Header className="flex-row items-start gap-3">
      <Clock className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
      <div>
        <Card.Title>Horario de atención</Card.Title>
        <Card.Description>{scheduleText}</Card.Description>
      </div>
    </Card.Header>
  </Card>
);
