import { useState } from 'react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { InicioSection } from '../components/organisms/InicioSection';
import { MisFichasSection } from '../components/organisms/MisFichasSection';
import { BuzonSugerenciasSection } from '../components/organisms/BuzonSugerenciasSection';
import { PerfilSection } from '../components/organisms/PerfilSection';

interface AprendizDashboardPageProps {
  user: User;
  onLogout: () => void;
}

/**
 * Panel del Aprendiz. Los beneficiarios no tienen rol aparte: aquí mismo ven el
 * almuerzo en $0 y reservan con un solo clic (el precio lo fija el backend).
 */
export const AprendizDashboardPage = ({ user, onLogout }: AprendizDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionType>('inicio');

  return (
    <DashboardLayout user={user} activeSection={activeSection} onSelectSection={setActiveSection} onLogout={onLogout}>
      {activeSection === 'inicio' && <InicioSection user={user} />}
      {activeSection === 'fichas' && <MisFichasSection />}
      {activeSection === 'sugerencias' && <BuzonSugerenciasSection />}
      {activeSection === 'perfil' && <PerfilSection user={user} />}
    </DashboardLayout>
  );
};
