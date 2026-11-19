import { useState } from 'react';
import { Card, Chip } from '@heroui/react';
import type { User } from '../schemas/auth.schema';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import type { SectionType } from '../components/organisms/Sidebar';
import { CuentaMensualCard } from '../components/molecules/CuentaMensualCard';
import { ScheduleCard } from '../components/molecules/ScheduleCard';
import { MiCuentaSection } from '../components/organisms/MiCuentaSection';
import { ConsumosSection } from '../components/organisms/ConsumosSection';
import { BuzonSugerenciasSection } from '../components/organisms/BuzonSugerenciasSection';
import { PerfilSection } from '../components/organisms/PerfilSection';
import { ReservaAlmuerzoCard } from '../components/organisms/ReservaAlmuerzoCard';
import { LoadingSpinner } from '../components/atoms/LoadingSpinner';
import { useMiCuenta } from '../hooks/useCartera';
import { useMenuActivo } from '../hooks/useMenu';
import { pesos } from '../lib/formato';

interface InstructorDashboardPageProps {
  user: User;
  onLogout: () => void;
}

/** Panel del Instructor: sus almuerzos se cargan a la cuenta mensual (Cartera de Deudas). */
export const InstructorDashboardPage = ({ user, onLogout }: InstructorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SectionType>('inicio');
  const { data: cuenta } = useMiCuenta();
  const { data: menu } = useMenuActivo();
  const pendingBalance = cuenta?.pendingBalance ?? 0;

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
            <Card.Footer className="flex-wrap gap-2">
              <Chip size="sm" variant="secondary">
                {cuenta?.monthlyLunches ?? 0} almuerzos este mes
              </Chip>
              <Chip size="sm" variant="soft" color={pendingBalance > 0 ? 'warning' : 'success'}>
                Saldo pendiente: {pesos(pendingBalance)}
              </Chip>
            </Card.Footer>
          </Card>

          <ReservaAlmuerzoCard
            user={user}
            note="Se agregará a tu cuenta mensual"
            tituloConfirmacion="Solicitar Almuerzo de Instructor"
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

          <div className="grid gap-4 md:grid-cols-2">
            <ScheduleCard
              scheduleText={
                menu ? `Reservas: ${menu.horario.abre} a ${menu.horario.cierra} (hora de Colombia)` : 'Reservas: 07:00 a 21:00'
              }
            />
            <CuentaMensualCard pendingBalance={pendingBalance} onViewAccount={() => setActiveSection('cuenta')} />
          </div>
        </div>
      )}

      {activeSection === 'cuenta' &&
        (cuenta ? (
          <MiCuentaSection
            totalConsumed={cuenta.totalConsumed}
            pendingBalance={cuenta.pendingBalance}
            paymentMethod={cuenta.paymentMethod}
            paymentFrequency={cuenta.paymentFrequency}
            nextCutoffDate={cuenta.nextCutoffDate}
          />
        ) : (
          <LoadingSpinner label="Cargando tu cuenta mensual..." />
        ))}

      {activeSection === 'consumos' && <ConsumosSection />}
      {activeSection === 'sugerencias' && <BuzonSugerenciasSection />}
      {activeSection === 'perfil' && <PerfilSection user={user} />}
    </DashboardLayout>
  );
};
