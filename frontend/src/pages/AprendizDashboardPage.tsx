import { useState } from 'react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { InicioSection } from '../components/organisms/InicioSection';
import { MisFichasSection, type FichaItem } from '../components/organisms/MisFichasSection';
import { BuzonSugerenciasSection } from '../components/organisms/BuzonSugerenciasSection';
import { PerfilSection } from '../components/organisms/PerfilSection';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '../components/atoms/Button';

interface AprendizDashboardPageProps {
  user: User;
  onLogout: () => void;
}

export const AprendizDashboardPage = ({ user: initialUser, onLogout }: AprendizDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionType>('inicio');
  const [user, setUser] = useState<User>(initialUser);
  const [totalLunches, setTotalLunches] = useState(5);
  const [monthlyLunches, setMonthlyLunches] = useState(5);
  const [totalSpent, setTotalSpent] = useState(25000);

  // Modal / Toast for Lunch Order Confirmation
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Mock Ficha History List
  const [history, setHistory] = useState<FichaItem[]>([
    { id: '1', date: '17 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '2', date: '16 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '3', date: '15 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '4', date: '14 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
    { id: '5', date: '13 Dic 2024', title: 'Menú del Día', price: '$5.000', status: 'CONSUMED' },
  ]);

  const handleRequestLunch = () => {
    setShowOrderModal(true);
  };

  const confirmOrder = () => {
    const todayFormatted = new Date().toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const newTicket: FichaItem = {
      id: String(Date.now()),
      date: todayFormatted,
      title: 'Menú del Día (Reservado)',
      price: '$5.000',
      status: 'RESERVED',
    };

    setHistory([newTicket, ...history]);
    setTotalLunches((prev) => prev + 1);
    setMonthlyLunches((prev) => prev + 1);
    setTotalSpent((prev) => prev + 5000);
    setShowOrderModal(false);
    setOrderSuccess(true);

    setTimeout(() => {
      setOrderSuccess(false);
    }, 4000);
  };

  const handleUpdateProfile = (updated: Partial<User>) => {
    setUser({ ...user, ...updated });
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
      {/* Toast Banner on Successful Lunch Reservation */}
      {orderSuccess && (
        <div className="mb-6 bg-emerald-600 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-200" />
            <div>
              <p className="font-extrabold text-sm sm:text-base">¡Almuerzo reservado con éxito!</p>
              <p className="text-xs text-emerald-100">
                Tu ficha fue generada y agregada al historial. Preséntate en el comedor con tu documento.
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

      {/* Modal for Order Confirmation */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900 animate-scale-up">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-200 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-center text-gray-900">
              Confirmar Reserva de Almuerzo
            </h3>

            <p className="text-sm text-gray-600 text-center mt-2 leading-relaxed">
              ¿Deseas solicitar el <span className="font-bold text-gray-900">Menú del Día</span> por un valor de{' '}
              <span className="font-bold text-emerald-600">$5.000</span>?
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-4 space-y-1 text-xs text-gray-600">
              <p><span className="font-bold">Aprendiz:</span> {user.name}</p>
              <p><span className="font-bold">Cédula:</span> {user.document}</p>
              <p><span className="font-bold">Ficha:</span> {user.ficha || '1'}</p>
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
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
