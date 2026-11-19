import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Avatar, Button, Chip } from '@heroui/react';
import type { User } from '../../schemas/auth.schema';
import { Sidebar, type SectionType, type InventarioSubSection } from '../organisms/Sidebar';
import { StatsHeader } from '../organisms/StatsHeader';
import { iniciales, TITULO_ROL } from '../../lib/usuario';

export interface DashboardLayoutProps {
  user: User;
  activeSection: SectionType;
  onSelectSection: (section: SectionType) => void;
  activeInventarioSubSection?: InventarioSubSection;
  onSelectInventarioSubSection?: (subSection: InventarioSubSection) => void;
  onLogout: () => void;
  children: ReactNode;
}

const TITULOS: Record<SectionType, string> = {
  inicio: 'Menú del día',
  fichas: 'Mis fichas',
  cuenta: 'Mi cuenta mensual',
  consumos: 'Historial de consumos',
  sugerencias: 'Buzón de sugerencias',
  perfil: 'Mi perfil',
  ventas: 'Ventas',
  menu: 'Menú del día',
  almuerzosInvitados: 'Almuerzos invitados',
  beneficiarios: 'Beneficiarios',
  deudas: 'Cartera de deudas',
  inventario: 'Inventario',
  grupos: 'Grupos y fichas',
  visitas: 'Visitas institucionales',
  solicitudes: 'Solicitudes de cuenta',
  usuarios: 'Usuarios',
  gestionFichas: 'Fichas de formación',
  cargas: 'Carga masiva de cuentas',
};

export const DashboardLayout = ({
  user,
  activeSection,
  onSelectSection,
  activeInventarioSubSection,
  onSelectInventarioSubSection,
  onLogout,
  children,
}: DashboardLayoutProps) => {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  const fechaHoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        user={user}
        activeSection={activeSection}
        onSelectSection={onSelectSection}
        activeInventarioSubSection={activeInventarioSubSection}
        onSelectInventarioSubSection={onSelectInventarioSubSection}
        onLogout={onLogout}
        isOpenMobile={menuMovilAbierto}
        onCloseMobile={() => setMenuMovilAbierto(false)}
      />

      <div className="flex min-h-screen min-w-0 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-separator bg-background/80 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="ghost"
              className="lg:hidden"
              aria-label="Abrir menú"
              onPress={() => setMenuMovilAbierto(true)}
            >
              <Menu />
            </Button>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{TITULOS[activeSection] ?? 'GastroSENA'}</h2>
              <p className="hidden text-xs capitalize text-muted sm:block">{fechaHoy}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Chip size="sm" variant="soft" className="hidden md:inline-flex">
              {TITULO_ROL[user.role]}
            </Chip>
            <Avatar size="sm" color="accent" variant="soft">
              <Avatar.Fallback>{iniciales(user.name)}</Avatar.Fallback>
            </Avatar>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <StatsHeader user={user} />
          {children}
        </main>
      </div>
    </div>
  );
};
