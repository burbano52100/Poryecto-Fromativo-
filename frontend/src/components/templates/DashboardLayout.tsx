import { useState, type ReactNode } from 'react';
import { Menu, UtensilsCrossed, Calendar } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';
import { Sidebar, type SectionType, type InventarioSubSection } from '../organisms/Sidebar';
import { StatsHeader } from '../organisms/StatsHeader';

export interface DashboardLayoutProps {
  user: User;
  activeSection: SectionType;
  onSelectSection: (section: SectionType) => void;
  activeInventarioSubSection?: InventarioSubSection;
  onSelectInventarioSubSection?: (subSection: InventarioSubSection) => void;
  onLogout: () => void;
  totalLunches?: number;
  monthlyLunches?: number;
  totalSpent?: string | number;
  pendingBalance?: string | number;
  children: ReactNode;
}

export const DashboardLayout = ({
  user,
  activeSection,
  onSelectSection,
  activeInventarioSubSection,
  onSelectInventarioSubSection,
  onLogout,
  totalLunches = 5,
  monthlyLunches = 5,
  totalSpent = '$25.000',
  pendingBalance = '$15.000',
  children,
}: DashboardLayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isInvitado = user.role === 'invitado';
  const isEncargado = user.role === 'encargado';
  const isInstructor = user.role === 'instructor';

  const sectionTitles: Record<SectionType, string> = {
    inicio: 'Inicio & Menú del Día',
    fichas: 'Mis Fichas',
    cuenta: 'Mi Cuenta Mensual',
    consumos: 'Historial de Consumos',
    sugerencias: 'Buzón de Sugerencias',
    perfil: 'Mi Perfil',
    ventas: 'Historial de Ventas',
    menu: 'Gestión del Menú del Día',
    deudas: 'Cartera de Deudas',
    inventario: 'Gestión de Inventarios (GastroSENA)',
    grupos: 'Grupos & Fichas SENA',
  };

  const currentDateFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const panelSubtitle = isInvitado
    ? 'Portal de Visitantes · Tecnoparque Yamboró GastroSENA'
    : isEncargado
    ? 'Panel de Administración del Comedor · GastroSENA'
    : isInstructor
    ? 'Panel del Instructor SENA · Sistema GastroSENA'
    : 'Panel del Aprendiz SENA · Sistema GastroSENA';

  const avatarColorStyles = isInvitado
    ? 'bg-teal-600 text-white border-teal-500'
    : isEncargado
    ? 'bg-amber-600 text-white border-amber-500'
    : isInstructor
    ? 'bg-indigo-600 text-white border-indigo-500'
    : 'bg-emerald-600 text-white border-emerald-500';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col lg:flex-row">
      {/* Sidebar Component (Fixed on desktop, drawer on mobile) */}
      <Sidebar
        user={user}
        activeSection={activeSection}
        onSelectSection={onSelectSection}
        activeInventarioSubSection={activeInventarioSubSection}
        onSelectInventarioSubSection={onSelectInventarioSubSection}
        onLogout={onLogout}
        totalLunchesCount={totalLunches}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Outer Wrapper (Margin left lg:ml-72 for sidebar) */}
      <div className="flex-1 lg:ml-72 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar Header (Mobile & Desktop Header) */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
          {/* Mobile Menu Toggle & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200"
              aria-label="Abrir Menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {sectionTitles[activeSection] || 'GastroSENA'}
              </h2>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                {panelSubtitle}
              </p>
            </div>
          </div>

          {/* Right Info Header */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>{currentDateFormatted}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-xs ${avatarColorStyles}`}>
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                {user.name}
              </span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {/* Top Metric Cards (StatsHeader) */}
          <StatsHeader
            user={user}
            totalLunches={totalLunches}
            monthlyLunches={monthlyLunches}
            totalSpent={totalSpent}
            pendingBalance={pendingBalance}
          />

          {/* Active Section Content */}
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
