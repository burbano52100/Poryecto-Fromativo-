import { useState } from 'react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { CuentaMensualCard } from '../components/molecules/CuentaMensualCard';
import { ScheduleCard } from '../components/molecules/ScheduleCard';
import { MenuCard } from '../components/molecules/MenuCard';
import { MiCuentaSection } from '../components/organisms/MiCuentaSection';
import { ConsumosSection, type ConsumoItem } from '../components/organisms/ConsumosSection';
import { BuzonSugerenciasSection } from '../components/organisms/BuzonSugerenciasSection';
import { PerfilSection } from '../components/organisms/PerfilSection';
import { CheckCircle2, X, Sparkles, GraduationCap } from 'lucide-react';
import { Button } from '../components/atoms/Button';

interface InstructorDashboardPageProps {
  user: User;
  onLogout: () => void;
}

export const InstructorDashboardPage = ({
  user: initialUser,
  onLogout,
}: InstructorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionType>('inicio');
  const [user, setUser] = useState<User>(initialUser);

  // Consumos and balance state
  const [monthlyLunches, setMonthlyLunches] = useState(5);
  const [totalConsumed, setTotalConsumed] = useState(25000);
  const [pendingBalance, setPendingBalance] = useState(15000);

  // Consumos list matching exact reference images
  const [consumos, setConsumos] = useState<ConsumoItem[]>([
    { id: '1', date: '16 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PAGADO' },
    { id: '2', date: '15 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PAGADO' },
    { id: '3', date: '14 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PENDIENTE' },
    { id: '4', date: '13 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PENDIENTE' },
    { id: '5', date: '12 Feb 2026', title: 'Menú del Día', price: '$5.000', paymentStatus: 'PENDIENTE' },
  ]);

  // Order modal & toast feedback
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const handleRequestLunch = () => {
    setShowOrderModal(true);
  };

  const confirmOrder = () => {
    const todayFormatted = new Date().toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const newConsumo: ConsumoItem = {
      id: String(Date.now()),
      date: todayFormatted,
      title: 'Menú del Día (Registrado)',
      price: '$5.000',
      paymentStatus: 'PENDIENTE',
    };

    setConsumos([newConsumo, ...consumos]);
    setMonthlyLunches((prev) => prev + 1);
    setTotalConsumed((prev) => prev + 5000);
    setPendingBalance((prev) => prev + 5000);

    setShowOrderModal(false);
    setOrderSuccess(true);

    setTimeout(() => {
      setOrderSuccess(false);
    }, 4000);
  };

  const handleUpdateProfile = (updated: Partial<User>) => {
    setUser({ ...user, ...updated });
  };

  const currentDateFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedDateString =
    currentDateFormatted.charAt(0).toUpperCase() + currentDateFormatted.slice(1);

  return (
    <DashboardLayout
      user={user}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onLogout={onLogout}
      totalLunches={consumos.length}
      monthlyLunches={monthlyLunches}
      totalSpent={totalConsumed}
      pendingBalance={pendingBalance}
    >
      {/* Toast Notification on Lunch Request */}
      {orderSuccess && (
        <div className="mb-6 bg-emerald-600 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-200" />
            <div>
              <p className="font-extrabold text-sm sm:text-base">¡Almuerzo solicitado correctamente!</p>
              <p className="text-xs text-emerald-100">
                Se ha registrado el consumo de $5.000 y se cargó a tu cuenta mensual.
              </p>
            </div>
          </div>
          <button
            onClick={() => setOrderSuccess(false)}
            className="p-1 hover:bg-emerald-700 rounded-lg text-emerald-200 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 1. INICIO SECTION */}
      {activeSection === 'inicio' && (
        <div className="space-y-6">
          {/* Welcome Banner Card */}
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900 via-emerald-800 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-emerald-500/20">
            <div className="absolute right-[-20px] top-[-20px] opacity-10 pointer-events-none">
              <GraduationCap className="w-64 h-64 text-white" />
            </div>

            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-emerald-100 mb-3 border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Panel de Instructor GastroSENA</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                ¡Bienvenido/a, {user.name}!
              </h2>

              <p className="text-sm sm:text-base text-emerald-100 mt-2 leading-relaxed">
                Puedes consumir tus almuerzos diarios y consolidar el pago mensualmente en la oficina del comedor escolar.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-200">
                <div className="bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-white/10">
                  Consumos este mes: <span className="text-white font-bold">{monthlyLunches} almuerzos</span>
                </div>
                <div className="bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-white/10">
                  Saldo pendiente: <span className="text-amber-300 font-bold">${pendingBalance.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Menú del Día */}
          <MenuCard
            dateText={formattedDateString}
            title="Menú del Día"
            description="Almuerzo completo: Sopa, bandeja con proteína, arroz, ensalada, jugo natural y postre."
            price="$5.000"
            note="Se agregará a tu cuenta mensual"
            imageUrl="/cafeteria-bg.jpg"
            isAvailable={true}
            onRequestLunch={handleRequestLunch}
          />

          {/* Bottom Grid: Horario de Atención y Cuenta Mensual Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ScheduleCard scheduleText="Lunes a Viernes: 7:00 AM - 6:00 PM" />
            <CuentaMensualCard
              pendingBalance={pendingBalance}
              onViewAccount={() => setActiveSection('cuenta')}
            />
          </div>
        </div>
      )}

      {/* 2. MI CUENTA SECTION */}
      {activeSection === 'cuenta' && (
        <MiCuentaSection
          totalConsumed={totalConsumed}
          pendingBalance={pendingBalance}
          paymentMethod="Efectivo en oficina del comedor"
          paymentFrequency="Mensual"
          nextCutoffDate="28 de Febrero 2026"
        />
      )}

      {/* 3. CONSUMOS SECTION */}
      {activeSection === 'consumos' && (
        <ConsumosSection items={consumos} />
      )}

      {/* 4. BUZON DE SUGERENCIAS SECTION */}
      {activeSection === 'sugerencias' && (
        <BuzonSugerenciasSection />
      )}

      {/* 5. PERFIL SECTION */}
      {activeSection === 'perfil' && (
        <PerfilSection
          user={user}
          totalLunches={consumos.length}
          totalSpent={totalConsumed}
          pendingBalance={pendingBalance}
          accountType="Mensual"
          onUpdateProfile={handleUpdateProfile}
        />
      )}

      {/* Order Lunch Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-200 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-center text-gray-900">
              Solicitar Almuerzo de Instructor
            </h3>

            <p className="text-sm text-gray-600 text-center mt-2 leading-relaxed">
              ¿Deseas registrar el <span className="font-bold text-gray-900">Menú del Día</span> por{' '}
              <span className="font-bold text-emerald-600">$5.000</span>? El valor se sumará a tu cuenta mensual.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-4 space-y-1 text-xs text-gray-600">
              <p><span className="font-bold">Instructor:</span> {user.name}</p>
              <p><span className="font-bold">Cédula:</span> {user.document}</p>
              <p><span className="font-bold">Tipo de Cuenta:</span> Mensual</p>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowOrderModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={confirmOrder}
                className="bg-green-600 hover:bg-green-700 shadow-green-600/30 font-bold"
              >
                Confirmar Registro
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
