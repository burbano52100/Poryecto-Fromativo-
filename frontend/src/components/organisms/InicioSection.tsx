import { GraduationCap, Sparkles, Award } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';
import { ScheduleCard } from '../molecules/ScheduleCard';
import { ProgressCard } from '../molecules/ProgressCard';
import { ReservaAlmuerzoCard } from './ReservaAlmuerzoCard';
import { useResumenConsumos } from '../../hooks/useConsumos';
import { useMenuActivo } from '../../hooks/useMenu';

export interface InicioSectionProps {
  user: User;
}

export const InicioSection = ({ user }: InicioSectionProps) => {
  const { data: resumen } = useResumenConsumos();
  const { data: menu } = useMenuActivo();
  // El estado de beneficiario vigente lo reporta el menú (se lee de la BD en cada consulta)
  const esBeneficiario = menu?.es_beneficiario ?? user.es_beneficiario ?? false;
  const almuerzosMes = resumen?.almuerzosMes ?? 0;

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

            {esBeneficiario && (
              <div className="inline-flex items-center gap-1.5 bg-amber-400 text-gray-950 font-black px-3 py-1 rounded-full text-xs shadow-md border border-amber-300">
                <Award className="w-3.5 h-3.5 text-gray-950" />
                <span>Beneficiario ($0 Gratis)</span>
              </div>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">¡Hola, {user.name}!</h2>

          <p className="text-sm sm:text-base text-emerald-100 mt-2 leading-relaxed">
            {esBeneficiario
              ? 'Cuentas con el beneficio de alimentación 100% subsidiada por el SENA. Puedes reservar tu almuerzo del día gratis con un solo clic.'
              : 'Reserva tu almuerzo del día con anticipación en la cafetería escolar SENA. Recuerda presentar tu documento o ficha al ingresar.'}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-200">
            <div className="bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-white/10">
              Ficha: <span className="text-white font-bold">{user.ficha || 'Sin ficha'}</span>
            </div>
            <div className="bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-white/10">
              Reservados este mes: <span className="text-white font-bold">{almuerzosMes} almuerzos</span>
            </div>
            {esBeneficiario && (
              <div className="bg-amber-400/20 text-amber-200 px-3 py-1.5 rounded-xl border border-amber-400/40 font-bold">
                Tarifa actual: $0 COP
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menú del Día con reserva real */}
      <ReservaAlmuerzoCard
        user={user}
        tituloConfirmacion="Confirmar Reserva de Almuerzo"
        detalleConfirmacion={(precio) => (
          <>
            <p className="text-center">
              ¿Deseas reservar el <span className="font-bold text-gray-900">Menú del Día</span> por un valor de{' '}
              <span className="font-bold text-emerald-600">{precio} COP</span>? Lo pagas en la ventanilla del comedor.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-4 space-y-1 text-xs text-gray-600">
              <p><span className="font-bold">Aprendiz:</span> {user.name}</p>
              <p><span className="font-bold">Cédula:</span> {user.document}</p>
              <p><span className="font-bold">Ficha:</span> {user.ficha || 'Sin ficha'}</p>
            </div>
          </>
        )}
        mensajeExito={(reserva) =>
          reserva.estado_pago === 'gratis'
            ? 'Tarifa: $0 COP (Beneficio 100% Subsidiado). Presenta tu documento o ficha en el comedor.'
            : `Tarifa: ${reserva.price} COP. Queda pendiente de pago hasta que la canceles en la ventanilla.`
        }
      />

      {/* Bottom Grid: Horario de reservas y progreso */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ScheduleCard
          scheduleText={
            menu ? `Reservas: ${menu.horario.abre} a ${menu.horario.cierra} (hora de Colombia)` : 'Reservas: 07:00 a 21:00'
          }
        />
        <ProgressCard consumedLunches={almuerzosMes} message="¡Mantén una alimentación balanceada!" />
      </div>
    </div>
  );
};
