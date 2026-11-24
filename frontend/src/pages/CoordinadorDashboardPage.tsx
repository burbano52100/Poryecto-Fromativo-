import { useState } from 'react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { SolicitudesCoordinadorSection } from '../components/organisms/coordinador/SolicitudesCoordinadorSection';
import { UsuariosCoordinadorSection } from '../components/organisms/coordinador/UsuariosCoordinadorSection';
import { FichasCoordinadorSection } from '../components/organisms/coordinador/FichasCoordinadorSection';
import { CargaMasivaSection } from '../components/organisms/coordinador/CargaMasivaSection';
import { PerfilSection } from '../components/organisms/PerfilSection';
import { StatsHeader } from '../components/organisms/StatsHeader';

interface CoordinadorDashboardPageProps {
  user: User;
  onLogout: () => void;
}

/**
 * Panel del Coordinador (ADR 018): aprueba las cuentas de aprendices e instructores, las activa o
 * desactiva, administra las fichas y hace cargas masivas. No ve ventas, inventario, deudas ni caja.
 */
export const CoordinadorDashboardPage = ({ user, onLogout }: CoordinadorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionType>('solicitudes');

  return (
    <DashboardLayout user={user} activeSection={activeSection} onSelectSection={setActiveSection} onLogout={onLogout}>
      {activeSection === 'solicitudes' && (
        <div className="flex flex-col gap-6">
          <StatsHeader user={user} activeSection={activeSection} onSelectSection={setActiveSection} />
          <SolicitudesCoordinadorSection />
        </div>
      )}
      {activeSection === 'usuarios' && <UsuariosCoordinadorSection />}
      {activeSection === 'gestionFichas' && <FichasCoordinadorSection />}
      {activeSection === 'cargas' && <CargaMasivaSection />}
      {activeSection === 'perfil' && <PerfilSection user={user} />}
    </DashboardLayout>
  );
};
