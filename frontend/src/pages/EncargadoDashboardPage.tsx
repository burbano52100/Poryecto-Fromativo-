import { useState } from 'react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType, InventarioSubSection } from '../components/organisms/Sidebar';
import { VentasSection } from '../components/organisms/VentasSection';
import { MenuDelDiaEncargadoSection } from '../components/organisms/MenuDelDiaEncargadoSection';
import { BeneficiariosSection } from '../components/organisms/BeneficiariosSection';
import { CarteraDeudasSection } from '../components/organisms/CarteraDeudasSection';
import { InventarioSection } from '../components/organisms/InventarioSection';
import { GruposSection } from '../components/organisms/GruposSection';
import { BuzonSugerenciasEncargadoSection } from '../components/organisms/BuzonSugerenciasEncargadoSection';
import { SolicitudesCuentaSection } from '../components/organisms/SolicitudesCuentaSection';
import { VisitasInstitucionalesSection } from '../components/organisms/VisitasInstitucionalesSection';

interface EncargadoDashboardPageProps {
  user?: User;
  onLogout: () => void;
}

export const EncargadoDashboardPage = ({
  user: initialUser,
  onLogout,
}: EncargadoDashboardPageProps) => {
  const defaultUser: User = {
    id: 'usr_encargado',
    document: '123456789',
    name: 'Carlos Encargado',
    role: 'encargado',
    email: 'carlos.encargado@sena.edu.co',
    status: 'ACTIVE',
  };

  const user = initialUser || defaultUser;

  const [activeSection, setActiveSection] = useState<SectionType>('ventas');
  const [activeInventarioSubSection, setActiveInventarioSubSection] =
    useState<InventarioSubSection>('stock');

  return (
    <DashboardLayout
      user={user}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      activeInventarioSubSection={activeInventarioSubSection}
      onSelectInventarioSubSection={setActiveInventarioSubSection}
      onLogout={onLogout}
    >
      {/* 1. VENTAS SECTION */}
      {activeSection === 'ventas' && <VentasSection />}

      {/* 2. MENÚ DEL DÍA SECTION */}
      {activeSection === 'menu' && <MenuDelDiaEncargadoSection />}

      {/* 3. BENEFICIARIOS SECTION */}
      {activeSection === 'beneficiarios' && <BeneficiariosSection />}

      {/* 4. CARTERA DE DEUDAS SECTION */}
      {activeSection === 'deudas' && <CarteraDeudasSection />}

      {/* 5. INVENTARIO SECTION (WITH 5 SUB-SECTIONS ACCORDION) */}
      {activeSection === 'inventario' && (
        <InventarioSection activeSubSection={activeInventarioSubSection} />
      )}

      {/* 6. GRUPOS SECTION */}
      {activeSection === 'grupos' && <GruposSection />}

      {/* 7. BUZÓN DE SUGERENCIAS SECTION */}
      {activeSection === 'sugerencias' && <BuzonSugerenciasEncargadoSection />}

      {/* 8. VISITAS INSTITUCIONALES */}
      {activeSection === 'visitas' && <VisitasInstitucionalesSection />}

      {/* 9. SOLICITUDES DE CUENTA (INSTRUCTOR / ENCARGADO) */}
      {activeSection === 'solicitudes' && <SolicitudesCuentaSection />}
    </DashboardLayout>
  );
};
