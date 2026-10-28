import { GraduationCap, Sparkles, Award } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';
import { MenuCard } from '../molecules/MenuCard';
import { ScheduleCard } from '../molecules/ScheduleCard';
import { ProgressCard } from '../molecules/ProgressCard';

export interface InicioSectionProps {
  user: User;
  onRequestLunch: () => void;
  monthlyLunches?: number;
}

export const InicioSection = ({
  user,
  onRequestLunch,
  monthlyLunches = 5,
}: InicioSectionProps) => {
  const currentDateFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Capitalize first letter of weekday
  const formattedDateString =
    currentDateFormatted.charAt(0).toUpperCase() + currentDateFormatted.slice(1);

  return (
    <div className="space-y-6">
      {/* Welcome Banner Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-800 via-green-700 to-emerald-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-emerald-500/20">
        <div className="absolute right-[-20px] top-[-20px] opacity-10 pointer-events-none">
          <GraduationCap className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-emerald-100 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Sistema Web de Reserva GastroSENA</span>
            </div>

            {user.es_beneficiario && (
              <div className="inline-flex items-center gap-1.5 bg-amber-400 text-gray-950 font-black px-3 py-1 rounded-full text-xs shadow-md border border-amber-300">
                <Award className="w-3.5 h-3.5 text-gray-950" />
                <span>Beneficiario ($0 Gratis)</span>
              </div>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            ¡Hola, {user.name}!
          </h2>

          <p className="text-sm sm:text-base text-emerald-100 mt-2 leading-relaxed">
            {user.es_beneficiario
              ? 'Cuentas con el beneficio de alimentación 100% subsidiada por el SENA. Puedes reservar tu almuerzo del día gratis con un solo clic.'
              : 'Reserva tu almuerzo del día con anticipación en la cafetería escolar SENA. Recuerda presentar tu documento o ficha al ingresar.'}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-200">
            <div className="bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-white/10">
              Ficha: <span className="text-white font-bold">{user.ficha || '2847251'}</span>
            </div>
            <div className="bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-white/10">
              Consumidos este mes: <span className="text-white font-bold">{monthlyLunches} almuerzos</span>
            </div>
            {user.es_beneficiario && (
              <div className="bg-amber-400/20 text-amber-200 px-3 py-1.5 rounded-xl border border-amber-400/40 font-bold">
                Tarifa actual: $0 COP
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Section: Menú del Día */}
      <MenuCard
        dateText={formattedDateString}
        title="Menú del Día"
        description="Almuerzo completo: Sopa del día, bandeja principal con proteína (pollo/carne), arroz, ensalada fresca, jugo natural de fruta de temporada y postre."
        price={user.es_beneficiario ? '$0' : '$5.000'}
        imageUrl="/cafeteria-bg.jpg"
        isAvailable={true}
        onRequestLunch={onRequestLunch}
        isBeneficiario={user.es_beneficiario}
      />

      {/* Bottom Grid: Horario de Atención y Tu Progreso */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ScheduleCard scheduleText="Lunes a Viernes: 7:00 AM - 6:00 PM" />
        <ProgressCard consumedLunches={monthlyLunches} message="¡Mantén una alimentación balanceada!" />
      </div>
    </div>
  );
};
