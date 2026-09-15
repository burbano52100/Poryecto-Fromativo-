import { Clock } from 'lucide-react';

export interface ScheduleCardProps {
  scheduleText?: string;
}

export const ScheduleCard = ({
  scheduleText = 'Lunes a Viernes: 7:00 AM - 6:00 PM',
}: ScheduleCardProps) => {
  return (
    <div className="bg-blue-50/70 border border-blue-100 rounded-3xl p-5 sm:p-6 flex items-start gap-4 shadow-xs">
      <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
        <Clock className="w-6 h-6" />
      </div>

      <div>
        <h3 className="text-base sm:text-lg font-bold text-blue-950 tracking-tight">
          Horario de Atención
        </h3>
        <p className="text-sm text-blue-800/80 mt-1 font-medium">
          {scheduleText}
        </p>
      </div>
    </div>
  );
};
