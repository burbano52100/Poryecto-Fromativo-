import { useState, useMemo } from 'react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { InicioSection } from '../components/organisms/InicioSection';
import { MisFichasSection, type FichaItem } from '../components/organisms/MisFichasSection';
import { BuzonSugerenciasSection } from '../components/organisms/BuzonSugerenciasSection';
import { PerfilSection } from '../components/organisms/PerfilSection';
import { CheckCircle2, X, Award } from 'lucide-react';
import { Button } from '../components/atoms/Button';
import { useEstudiantesQuery } from '../hooks/useBeneficiarios';

interface AprendizDashboardPageProps {
  user: User;
  onLogout: () => void;
}

export const AprendizDashboardPage = ({ user: initialUser, onLogout }: AprendizDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionType>('inicio');
  const [profileOverrides, setProfileOverrides] = useState<Partial<User>>({});
  const [simulatedBeneficiario, setSimulatedBeneficiario] = useState<boolean | null>(null);

  const { data: estudiantes } = useEstudiantesQuery();

  // Derivar de forma reactiva y pura el estado de beneficiario sincronizado con Encargado
  const effectiveBeneficiario = useMemo(() => {
    if (simulatedBeneficiario !== null) return simulatedBeneficiario;
    if (estudiantes && estudiantes.length > 0) {
      const match = estudiantes.find(
        (e) => e.id === initialUser.id || e.document === initialUser.document
      );
      if (match) return match.es_beneficiario;
    }
    return initialUser.es_beneficiario ?? true;
  }, [simulatedBeneficiario, estudiantes, initialUser.id, initialUser.document, initialUser.es_beneficiario]);

  const user: User = useMemo(() => {
    return {
      ...initialUser,
      ...profileOverrides,
      es_beneficiario: effectiveBeneficiario,
    };
  }, [initialUser, profileOverrides, effectiveBeneficiario]);

  const [totalLunches, setTotalLunches] = useState(5);
  const [monthlyLunches, setMonthlyLunches] = useState(5);
  const [totalSpent, setTotalSpent] = useState(() => (effectiveBeneficiario ? 0 : 25000));

  // Modal / Toast for Lunch Order Confirmation
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Mock Ficha History List - Respeta los precios históricos ya registrados
  const [history, setHistory] = useState<FichaItem[]>([
    { id: '1', date: '17 Dic 2024', title: 'Menú del Día', price: effectiveBeneficiario ? '$0' : '$5.000', status: 'CONSUMED' },
    { id: '2', date: '16 Dic 2024', title: 'Menú del Día', price: effectiveBeneficiario ? '$0' : '$5.000', status: 'CONSUMED' },
    { id: '3', date: '15 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '4', date: '14 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '5', date: '13 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
  ]);

  /**
   * REGLA PASO 5:
   * Los beneficiarios NO tienen rol aparte: siguen en el perfil de Aprendiz.
   * Ahí ven el almuerzo en $0 (gratis), un badge "Beneficiario" y reservan con UN SOLO CLIC.
   * Si no es beneficiario, se abre el modal de confirmación con costo $5.000.
   */
  const handleRequestLunch = () => {
    if (user.es_beneficiario) {
      // Reserva directa con un solo clic a $0 (Sin modal intermedio)
      executeReservation(true);
    } else {
      // Abre modal de confirmación a $5.000
      setShowOrderModal(true);
    }
  };

  const executeReservation = (isFree: boolean) => {
    const todayFormatted = new Date().toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const newTicket: FichaItem = {
      id: String(Date.now()),
      date: todayFormatted,
      title: isFree ? 'Menú del Día (Subsidio $0)' : 'Menú del Día (Reservado)',
      price: isFree ? '$0' : '$5.000',
      status: 'RESERVED',
    };

    setHistory((prev) => [newTicket, ...prev]);
    setTotalLunches((prev) => prev + 1);
    setMonthlyLunches((prev) => prev + 1);
    if (!isFree) {
      setTotalSpent((prev) => prev + 5000);
    }

    setShowOrderModal(false);
    setSuccessMessage(
      isFree
        ? '¡Almuerzo reservado con éxito! Tarifa: $0 COP (Beneficio 100% Subsidiado). Presenta tu cédula o ficha en el comedor.'
        : '¡Almuerzo reservado con éxito! Tarifa: $5.000 COP. Ficha agregada a tu historial de consumos.'
    );
    setOrderSuccess(true);

    setTimeout(() => {
      setOrderSuccess(false);
    }, 4500);
  };

  const handleUpdateProfile = (updated: Partial<User>) => {
    setProfileOverrides((prev) => ({ ...prev, ...updated }));
  };

  // Switch de prueba interactivo para alternar entre beneficiario y no beneficiario (DEV)
  const toggleDemoBeneficiario = () => {
    setSimulatedBeneficiario(!effectiveBeneficiario);
  };

  return (
    <DashboardLayout
      user={user}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onLogout={onLogout}
      totalLunches={totalLunches}
      monthlyLunches={monthlyLunches}
      totalSpent={totalSpent}
    >
      {/* Barra de simulación rápida para evaluadores (Solo visible en DEV) */}
      {import.meta.env.DEV && (
        <div className="mb-4 bg-amber-50 border border-amber-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-gray-700">
              Estado en perfil Aprendiz:{' '}
              <strong className={user.es_beneficiario ? 'text-amber-800 font-extrabold' : 'text-gray-900'}>
                {user.es_beneficiario ? 'Beneficiario ($0 Gratis - Reserva 1 Clic)' : 'Tarifa Regular ($5.000)'}
              </strong>
            </span>
          </div>

          <button
            onClick={toggleDemoBeneficiario}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer shadow-xs transition"
            title="Alterna entre beneficiario ($0) y regular ($5.000) para probar ambos flujos"
          >
            Probar como: {user.es_beneficiario ? 'Aprendiz Regular ($5.000)' : 'Beneficiario ($0)'}
          </button>
        </div>
      )}

      {/* Toast Banner on Successful Lunch Reservation */}
      {orderSuccess && (
        <div className="mb-6 bg-emerald-600 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-200 shrink-0" />
            <div>
              <p className="font-extrabold text-sm sm:text-base">¡Almuerzo reservado con éxito!</p>
              <p className="text-xs text-emerald-100">{successMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setOrderSuccess(false)}
            className="p-1 hover:bg-emerald-700 rounded-lg text-emerald-200 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Render Active Section Content */}
      {activeSection === 'inicio' && (
        <InicioSection
          user={user}
          onRequestLunch={handleRequestLunch}
          monthlyLunches={monthlyLunches}
        />
      )}

      {activeSection === 'fichas' && (
        <MisFichasSection history={history} />
      )}

      {activeSection === 'sugerencias' && (
        <BuzonSugerenciasSection />
      )}

      {activeSection === 'perfil' && (
        <PerfilSection
          user={user}
          totalLunches={totalLunches}
          totalSpent={totalSpent}
          onUpdateProfile={handleUpdateProfile}
        />
      )}

      {/* Modal for Order Confirmation (Solo para aprendices con tarifa regular $5.000) */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900 animate-scale-up">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-200 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-center text-gray-900">
              Confirmar Reserva de Almuerzo
            </h3>

            <p className="text-sm text-gray-600 text-center mt-2 leading-relaxed">
              ¿Deseas solicitar el <span className="font-bold text-gray-900">Menú del Día</span> por un valor de{' '}
              <span className="font-bold text-emerald-600">$5.000 COP</span>?
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-4 space-y-1 text-xs text-gray-600">
              <p><span className="font-bold">Aprendiz:</span> {user.name}</p>
              <p><span className="font-bold">Cédula:</span> {user.document}</p>
              <p><span className="font-bold">Ficha:</span> {user.ficha || '2847251'}</p>
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
                onClick={() => executeReservation(false)}
                className="bg-green-600 hover:bg-green-700 shadow-green-600/30 font-bold"
              >
                Confirmar ($5.000)
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
