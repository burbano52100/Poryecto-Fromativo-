import { useState } from 'react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { InicioInvitadoSection } from '../components/organisms/InicioInvitadoSection';
import { BuzonSugerenciasSection } from '../components/organisms/BuzonSugerenciasSection';

interface InvitadoDashboardPageProps {
  user: User;
  onLogout: () => void;
}

export const InvitadoDashboardPage = ({ user, onLogout }: InvitadoDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionType>('inicio');

  return (
    <DashboardLayout user={user} activeSection={activeSection} onSelectSection={setActiveSection} onLogout={onLogout}>
      {activeSection === 'inicio' && <InicioInvitadoSection user={user} />}
      {activeSection === 'sugerencias' && <BuzonSugerenciasSection />}
    </DashboardLayout>
  );
};
