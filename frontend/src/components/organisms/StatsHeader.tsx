import { Utensils, Calendar, DollarSign, IdCard, CreditCard, ShoppingCart, Mail, Heart, MapPin, CheckCircle2 } from 'lucide-react';
import { StatCard } from '../atoms/StatCard';
import type { User } from '../../schemas/auth.schema';

export interface StatsHeaderProps {
  user: User;
  totalLunches?: number;
  monthlyLunches?: number;
  totalSpent?: number | string;
  pendingBalance?: number | string;
}

export const StatsHeader = ({
  user,
  totalLunches = 5,
  monthlyLunches = 5,
  totalSpent = '$25.000',
  pendingBalance = '$15.000',
}: StatsHeaderProps) => {
  const isInvitado = user.role === 'invitado';
  const isEncargado = user.role === 'encargado';
  const isInstructor = user.role === 'instructor';

  const formattedSpent =
    typeof totalSpent === 'number'
      ? `$${totalSpent.toLocaleString('es-CO')}`
      : totalSpent;

  const formattedPending =
    typeof pendingBalance === 'number'
      ? `$${pendingBalance.toLocaleString('es-CO')}`
      : pendingBalance;

  const hasPending =
    typeof pendingBalance === 'number'
      ? pendingBalance > 0
      : pendingBalance !== '$0' && pendingBalance !== '$0.00';

  if (isInvitado) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Atención Particular"
          value="Ventanilla Directa"
          subtitle="Comedor escolar SENA"
          icon={<Heart className="w-6 h-6" />}
          variant="teal"
          badgeText="Visitante"
        />

        <StatCard
          title="Precio Invitados"
          value="$8.000 COP"
          subtitle="Tarifa plena por plato"
          icon={<DollarSign className="w-6 h-6" />}
          variant="emerald"
          badgeText="Tarifa Plena"
        />

        <StatCard
          title="Sede & Ubicación"
          value="Yamboró Pitalito"
          subtitle="Tecnoparque Agroecológico"
          icon={<MapPin className="w-6 h-6" />}
          variant="amber"
          badgeText="Huila"
        />

        <StatCard
          title="Estado del Servicio"
          value="Disponible"
          subtitle="Servicio de almuerzos activo"
          icon={<CheckCircle2 className="w-6 h-6" />}
          variant="blue"
          badgeText="Abierto"
        />
      </div>
    );
  }

  if (isEncargado) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Ventas de Hoy"
          value="125 Almuerzos"
          subtitle="Proyección del día"
          icon={<ShoppingCart className="w-6 h-6" />}
          variant="green"
          badgeText="Hoy"
        />

        <StatCard
          title="Ingresos de Hoy"
          value="$625.000 COP"
          subtitle="Precio único $5.000"
          icon={<DollarSign className="w-6 h-6" />}
          variant="emerald"
          badgeText="Recaudado"
        />

        <StatCard
          title="Deudas Pendientes"
          value="$15.000"
          subtitle="3 Instructores por cobrar"
          icon={<CreditCard className="w-6 h-6" />}
          variant="amber"
          badgeText="Por Cobrar"
        />

        <StatCard
          title="Sugerencias"
          value="2 Pendientes"
          subtitle="Buzón de atención"
          icon={<Mail className="w-6 h-6" />}
          variant="blue"
          badgeText="Revisión"
        />
      </div>
    );
  }

  if (isInstructor) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Almuerzos Este Mes"
          value={monthlyLunches}
          subtitle="Mes actual"
          icon={<Calendar className="w-6 h-6" />}
          variant="emerald"
          badgeText="Consumos"
        />

        <StatCard
          title="Saldo Pendiente"
          value={formattedPending}
          subtitle={hasPending ? 'Por cancelar en oficina' : 'Cuenta al día'}
          icon={<CreditCard className="w-6 h-6" />}
          variant={hasPending ? 'amber' : 'green'}
          badgeText={hasPending ? 'Pendiente' : 'Al día'}
        />

        <StatCard
          title="Total Consumido"
          value={formattedSpent}
          subtitle="Acumulado histórico"
          icon={<DollarSign className="w-6 h-6" />}
          variant="blue"
        />

        <StatCard
          title="Documento & Rol"
          value={`C.C. ${user.document}`}
          subtitle="Instructor SENA"
          icon={<IdCard className="w-6 h-6" />}
          variant="purple"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Total Almuerzos"
        value={totalLunches}
        subtitle="Historial acumulado"
        icon={<Utensils className="w-6 h-6" />}
        variant="green"
        badgeText="Consumidos"
      />

      <StatCard
        title="Almuerzos Este Mes"
        value={monthlyLunches}
        subtitle="Mes actual"
        icon={<Calendar className="w-6 h-6" />}
        variant="emerald"
        badgeText="Fichas"
      />

      <StatCard
        title="Total Gastado"
        value={formattedSpent}
        subtitle="Inversión en alimentación"
        icon={<DollarSign className="w-6 h-6" />}
        variant="amber"
      />

      <StatCard
        title="Ficha & Documento"
        value={user.ficha || 'Ficha 1'}
        subtitle={`C.C. ${user.document}`}
        icon={<IdCard className="w-6 h-6" />}
        variant="blue"
      />
    </div>
  );
};
