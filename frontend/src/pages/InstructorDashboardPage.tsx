import { useState } from 'react';
import { Card } from '@heroui/react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { MiCuentaSection } from '../components/organisms/MiCuentaSection';
import { ConsumosSection } from '../components/organisms/ConsumosSection';
import { BuzonSugerenciasSection } from '../components/organisms/BuzonSugerenciasSection';
import { PerfilSection } from '../components/organisms/PerfilSection';
import { ReservaAlmuerzoCard } from '../components/organisms/ReservaAlmuerzoCard';
import { ListSkeleton } from '../components/molecules/ListSkeleton';
import { useMiCuenta } from '../hooks/useCartera';

interface InstructorDashboardPageProps {
  user: User;
  onLogout: () => void;
}

/** Panel del Instructor: sus almuerzos se cargan a la cuenta mensual (Cartera de Deudas). */
export const InstructorDashboardPage = ({ user, onLogout }: InstructorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionType>('inicio');
  const { data: cuenta } = useMiCuenta();

  return (
    <DashboardLayout user={user} activeSection={activeSection} onSelectSection={setActiveSection} onLogout={onLogout}>
      {activeSection === 'inicio' && (
        <div className="flex flex-col gap-6">
          <Card>
            <Card.Header className="gap-1">
              <Card.Title className="text-xl">Hola, {user.name.split(' ')[0]}</Card.Title>
              <Card.Description>
                Consume tus almuerzos del día y paga el total del mes en la oficina del comedor.
              </Card.Description>
            </Card.Header>
          </Card>

          <ReservaAlmuerzoCard
            user={user}
            note="Se agregará a tu cuenta mensual"
            tituloConfirmacion="Solicitar almuerzo de instructor"
            detalleConfirmacion={(precio) => (
              <div className="flex flex-col gap-3">
                <p>
                  ¿Registras el menú del día por <span className="font-medium text-foreground">{precio}</span>? El valor se
                  suma a tu cuenta mensual.
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-surface-secondary p-3 text-xs">
                  <dt>Instructor</dt>
                  <dd className="text-foreground">{user.name}</dd>
                  <dt>Cédula</dt>
                  <dd className="text-foreground">{user.document}</dd>
                  <dt>Tipo de cuenta</dt>
                  <dd className="text-foreground">Mensual</dd>
                </dl>
              </div>
            )}
            mensajeExito={(reserva) => `Se registró el consumo de ${reserva.price} y se cargó a tu cuenta mensual.`}
          />
        </div>
      )}

      {activeSection === 'cuenta' &&
        (cuenta ? (
          <MiCuentaSection
            totalConsumed={cuenta.totalConsumed}
            paymentMethod={cuenta.paymentMethod}
            paymentFrequency={cuenta.paymentFrequency}
            nextCutoffDate={cuenta.nextCutoffDate}
          />
        ) : (
          <Card>
            <ListSkeleton label="Cargando tu cuenta mensual..." forma="tarjetas" filas={2} />
          </Card>
        ))}

      {activeSection === 'consumos' && <ConsumosSection />}
      {activeSection === 'sugerencias' && <BuzonSugerenciasSection />}
      {activeSection === 'perfil' && <PerfilSection user={user} />}
    </DashboardLayout>
  );
};
