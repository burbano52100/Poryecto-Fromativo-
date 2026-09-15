import { useState } from 'react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { InicioInvitadoSection } from '../components/organisms/InicioInvitadoSection';
import { BuzonSugerenciasSection } from '../components/organisms/BuzonSugerenciasSection';
import { CheckCircle2, X, ShoppingBag } from 'lucide-react';
import { Button } from '../components/atoms/Button';

interface InvitadoDashboardPageProps {
  user?: User;
  onLogout: () => void;
}

export const InvitadoDashboardPage = ({
  user: initialUser,
  onLogout,
}: InvitadoDashboardPageProps) => {
  const defaultUser: User = {
    id: 'INV-2026-01',
    document: 'INV001',
    name: 'Invitado Particular',
    role: 'invitado',
    email: 'visitante@sena.edu.co',
    status: 'ACTIVE',
  };

  const user = initialUser || defaultUser;

  const [activeSection, setActiveSection] = useState<SectionType>('inicio');
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);

  const handleBuyLunch = () => {
    setShowBuyModal(true);
  };

  const confirmBuy = () => {
    setShowBuyModal(false);
    setBuySuccess(true);
    setTimeout(() => setBuySuccess(false), 4500);
  };

  return (
    <DashboardLayout
      user={user}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onLogout={onLogout}
    >
      {/* Toast Banner for Successful Purchase */}
      {buySuccess && (
        <div className="mb-6 bg-teal-700 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-teal-200" />
            <div>
              <p className="font-extrabold text-sm sm:text-base">¡Compra de almuerzo registrada!</p>
              <p className="text-xs text-teal-100">
                Preséntate en la caja del comedor escolar para efectuar el pago de $8.000 COP y recibir tu bandeja.
              </p>
            </div>
          </div>
          <button
            onClick={() => setBuySuccess(false)}
            className="p-1 hover:bg-teal-800 rounded-lg text-teal-200 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ACTIVE SECTION RENDERING */}
      {activeSection === 'inicio' && (
        <InicioInvitadoSection user={user} onBuyLunch={handleBuyLunch} />
      )}

      {activeSection === 'sugerencias' && (
        <BuzonSugerenciasSection />
      )}

      {/* Buy Confirmation Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900">
            <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4 border border-teal-200 mx-auto">
              <ShoppingBag className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-center text-gray-900">
              Comprar Almuerzo de Invitado
            </h3>

            <p className="text-sm text-gray-600 text-center mt-2 leading-relaxed">
              ¿Deseas efectuar la compra del <span className="font-bold text-gray-900">Menú del Día</span> a tarifa de visitante por{' '}
              <span className="font-bold text-teal-700">$8.000 COP</span>?
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-4 space-y-1 text-xs text-gray-600">
              <p><span className="font-bold">Cliente:</span> {user.name}</p>
              <p><span className="font-bold">Sede:</span> Tecnoparque Yamboró (Pitalito, Huila)</p>
              <p><span className="font-bold">Tarifa:</span> Venta Directa Particular</p>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowBuyModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={confirmBuy}
                className="bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/30 font-bold"
              >
                Confirmar Compra
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
