import { useState } from 'react';
import { Sparkles, GraduationCap } from 'lucide-react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { CuentaMensualCard } from '../components/molecules/CuentaMensualCard';
import { ScheduleCard } from '../components/molecules/ScheduleCard';
import { MiCuentaSection } from '../components/organisms/MiCuentaSection';
import { ConsumosSection } from '../components/organisms/ConsumosSection';
import { BuzonSugerenciasSection } from '../components/organisms/BuzonSugerenciasSection';
import { PerfilSection } from '../components/organisms/PerfilSection';
import { ReservaAlmuerzoCard } from '../components/organisms/ReservaAlmuerzoCard';
import { LoadingSpinner } from '../components/atoms/LoadingSpinner';
import { useMiCuenta } from '../hooks/useCartera';
import { useMenuActivo } from '../hooks/useMenu';
import { pesos } from '../lib/formato';

interface InstructorDashboardPageProps {
  user: User;
  onLogout: () => void;
}

/** Panel del Instructor: sus almuerzos se cargan a la cuenta mensual (Cartera de Deudas). */
export const InstructorDashboardPage = ({ user, onLogout }: InstructorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionType>('inicio');
  const { data: cuenta } = useMiCuenta();
  const { data: menu } = useMenuActivo();
  const pendingBalance = cuenta?.pendingBalance ?? 0;

  return (
    <DashboardLayout user={user} activeSection={activeSection} onSelectSection={setActiveSection} onLogout={onLogout}>
      {activeSection === 'inicio' && (
        <div className="space-y-6">
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900 via-emerald-800 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-emerald-500/20">
            <div className="absolute right-[-20px] top-[-20px] opacity-10 pointer-events-none">
              <GraduationCap className="w-64 h-64 text-white" />
            </div>

            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-emerald-100 mb-3 border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Panel de Instructor GastroSENA</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">¡Bienvenido/a, {user.name}!</h2>

              <p className="text-sm sm:text-base text-emerald-100 mt-2 leading-relaxed">
                Puedes consumir tus almuerzos diarios y consolidar el pago mensualmente en la oficina del comedor escolar.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-200">
                <div className="bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-white/10">
                  Consumos este mes: <span className="text-white font-bold">{cuenta?.monthlyLunches ?? 0} almuerzos</span>
                </div>
                <div className="bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-white/10">
                  Saldo pendiente: <span className="text-amber-300 font-bold">{pesos(pendingBalance)}</span>
                </div>
              </div>
            </div>
          </div>

          <ReservaAlmuerzoCard
            user={user}
            note="Se agregará a tu cuenta mensual"
            tituloConfirmacion="Solicitar Almuerzo de Instructor"
            detalleConfirmacion={(precio) => (
              <>
                <p className="text-center">
                  ¿Deseas registrar el <span className="font-bold text-gray-900">Menú del Día</span> por{' '}
                  <span className="font-bold text-emerald-600">{precio}</span>? El valor se sumará a tu cuenta mensual.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-4 space-y-1 text-xs text-gray-600">
                  <p><span className="font-bold">Instructor:</span> {user.name}</p>
                  <p><span className="font-bold">Cédula:</span> {user.document}</p>
                  <p><span className="font-bold">Tipo de Cuenta:</span> Mensual</p>
                </div>
              </>
            )}
            mensajeExito={(reserva) => `Se registró el consumo de ${reserva.price} y se cargó a tu cuenta mensual.`}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ScheduleCard
              scheduleText={
                menu ? `Reservas: ${menu.horario.abre} a ${menu.horario.cierra} (hora de Colombia)` : 'Reservas: 07:00 a 21:00'
              }
            />
            <CuentaMensualCard pendingBalance={pendingBalance} onViewAccount={() => setActiveSection('cuenta')} />
          </div>
        </div>
      )}

      {activeSection === 'cuenta' &&
        (cuenta ? (
          <MiCuentaSection
            totalConsumed={cuenta.totalConsumed}
            pendingBalance={cuenta.pendingBalance}
            paymentMethod={cuenta.paymentMethod}
            paymentFrequency={cuenta.paymentFrequency}
            nextCutoffDate={cuenta.nextCutoffDate}
          />
        ) : (
          <LoadingSpinner label="Cargando tu cuenta mensual..." />
        ))}

      {activeSection === 'consumos' && <ConsumosSection />}
      {activeSection === 'sugerencias' && <BuzonSugerenciasSection />}
      {activeSection === 'perfil' && <PerfilSection user={user} />}
    </DashboardLayout>
  );
};
