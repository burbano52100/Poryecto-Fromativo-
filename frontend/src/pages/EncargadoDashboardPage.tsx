import { useState } from 'react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType, InventarioSubSection } from '../components/organisms/Sidebar';
import { VentasSection } from '../components/organisms/VentasSection';
import { CifrasVentasHoy } from '../components/organisms/CifrasDelPerfil';
import { MenuDelDiaEncargadoSection } from '../components/organisms/MenuDelDiaEncargadoSection';
import { AlmuerzosInvitadosSection } from '../components/organisms/AlmuerzosInvitadosSection';
import { AlmuerzosEspecialesSection } from '../components/organisms/AlmuerzosEspecialesSection';
import { BeneficiariosSection } from '../components/organisms/BeneficiariosSection';
import { CarteraDeudasSection } from '../components/organisms/CarteraDeudasSection';
import { InventarioSection } from '../components/organisms/InventarioSection';
import { GruposSection } from '../components/organisms/GruposSection';
import { BuzonSugerenciasEncargadoSection } from '../components/organisms/BuzonSugerenciasEncargadoSection';
import { VisitasInstitucionalesSection } from '../components/organisms/VisitasInstitucionalesSection';
import { ComprobantesSection } from '../components/organisms/ComprobantesSection';

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
      {/* 1. VENTAS: primero las ventas de hoy, en el color del perfil */}
      {activeSection === 'ventas' && (
        <div className="flex flex-col gap-6">
          <CifrasVentasHoy />
          <VentasSection />
        </div>
      )}

      {/* 1b. PAGOS CON QR: comprobantes por revisar y los de hoy (ADR 027) */}
      {activeSection === 'comprobantes' && <ComprobantesSection />}

      {/* 2. MENÚ DEL DÍA SECTION */}
      {activeSection === 'menu' && <MenuDelDiaEncargadoSection />}

      {/* 2b. ALMUERZOS INVITADOS (INSTRUCTORES, APRENDICES, CORRIENTES) */}
      {activeSection === 'almuerzosInvitados' && <AlmuerzosInvitadosSection />}

      {/* 2c. ALMUERZOS ESPECIALES POR CONTRATO (ADR 024) */}
      {activeSection === 'almuerzosEspeciales' && <AlmuerzosEspecialesSection />}

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
    </DashboardLayout>
  );
};
