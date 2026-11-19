import { Utensils, Calendar, DollarSign, IdCard, CreditCard, ShoppingCart, Mail, UserPlus, UserCheck, Users, GraduationCap } from 'lucide-react';
import { StatCard } from '../atoms/StatCard';
import type { User } from '../../schemas/auth.schema';
import { useResumenConsumos } from '../../hooks/useConsumos';
import { useMiCuenta } from '../../hooks/useCartera';
import { useResumenEncargado } from '../../hooks/useVentas';
import { useResumenCoordinador } from '../../hooks/useCoordinador';
import { pesos } from '../../lib/formato';

export interface StatsHeaderProps {
  user: User;
}

const GRID = 'mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4';

/** `undefined` mientras carga (la tarjeta muestra un Skeleton) y el valor formateado cuando llega. */
const valor = <T,>(dato: T | undefined, formato: (v: T) => string | number) =>
  dato === undefined ? undefined : formato(dato);

const StatsEncargado = () => {
  const { data } = useResumenEncargado();
  return (
    <div className={GRID}>
      <StatCard
        title="Ventas de Hoy"
        value={valor(data?.ventasHoy, (n) => `${n} almuerzos`)}
        subtitle={data ? `Incluye ${data.invitadosHoy} de almuerzos invitados` : 'Reservas y almuerzos invitados'}
        icon={<ShoppingCart className="size-5" />}
        tone="success"
      />
      <StatCard
        title="Ingresos de Hoy"
        value={valor(data?.ingresosHoy, pesos)}
        subtitle={
          data
            ? `Invitados: ${pesos(data.ingresosInvitadosHoy)} · Por cobrar: ${pesos(data.porCobrarHoy)}`
            : 'Solo almuerzos pagados'
        }
        icon={<DollarSign className="size-5" />}
        tone="accent"
      />
      <StatCard
        title="Deudas Pendientes"
        value={valor(data?.deudasPendientes.monto, pesos)}
        subtitle={data ? `${data.deudasPendientes.cantidad} cuenta(s) por cobrar` : 'Cartera de instructores'}
        icon={<CreditCard className="size-5" />}
        tone="warning"
      />
      <StatCard
        title="Sugerencias"
        value={valor(data?.sugerenciasPendientes, (n) => `${n} pendiente${n === 1 ? '' : 's'}`)}
        subtitle="Buzón de atención"
        icon={<Mail className="size-5" />}
        tone="accent"
      />
    </div>
  );
};

const StatsCoordinador = () => {
  const { data } = useResumenCoordinador();
  return (
    <div className={GRID}>
      <StatCard
        title="Solicitudes Pendientes"
        value={valor(data?.pendientes, (n) => n)}
        subtitle="Cuentas por aprobar"
        icon={<UserPlus className="size-5" />}
        tone="warning"
      />
      <StatCard
        title="Cuentas Activas"
        value={valor(data?.activos, (n) => n)}
        subtitle="Instructores y aprendices"
        icon={<UserCheck className="size-5" />}
        tone="success"
      />
      <StatCard
        title="Instructores"
        value={valor(data?.instructores, (n) => n)}
        subtitle="Con cuenta activa"
        icon={<Users className="size-5" />}
        tone="default"
      />
      <StatCard
        title="Aprendices"
        value={valor(data?.aprendices, (n) => n)}
        subtitle="Con cuenta activa"
        icon={<GraduationCap className="size-5" />}
        tone="accent"
      />
    </div>
  );
};

const StatsInstructor = ({ user }: StatsHeaderProps) => {
  const { data: cuenta } = useMiCuenta();
  const { data: resumen } = useResumenConsumos();
  const pendiente = cuenta?.pendingBalance ?? 0;
  return (
    <div className={GRID}>
      <StatCard
        title="Almuerzos Este Mes"
        value={valor(cuenta?.monthlyLunches, (n) => n)}
        subtitle="Mes actual"
        icon={<Calendar className="size-5" />}
        tone="accent"
      />
      <StatCard
        title="Saldo Pendiente"
        value={valor(cuenta?.pendingBalance, pesos)}
        subtitle={pendiente > 0 ? 'Por cancelar en oficina' : 'Cuenta al día'}
        icon={<CreditCard className="size-5" />}
        tone={pendiente > 0 ? 'warning' : 'success'}
        badgeText={pendiente > 0 ? 'Pendiente' : 'Al día'}
      />
      <StatCard
        title="Total Consumido"
        value={valor(resumen?.gastoTotal, pesos)}
        subtitle="Acumulado histórico"
        icon={<DollarSign className="size-5" />}
        tone="accent"
      />
      <StatCard
        title="Documento & Rol"
        value={`C.C. ${user.document}`}
        subtitle="Instructor SENA"
        icon={<IdCard className="size-5" />}
        tone="default"
      />
    </div>
  );
};

const StatsAprendiz = ({ user }: StatsHeaderProps) => {
  const { data: resumen } = useResumenConsumos();
  return (
    <div className={GRID}>
      <StatCard
        title="Total Almuerzos"
        value={valor(resumen?.totalAlmuerzos, (n) => n)}
        subtitle="Historial acumulado"
        icon={<Utensils className="size-5" />}
        tone="success"
      />
      <StatCard
        title="Almuerzos Este Mes"
        value={valor(resumen?.almuerzosMes, (n) => n)}
        subtitle="Mes actual"
        icon={<Calendar className="size-5" />}
        tone="accent"
      />
      <StatCard
        title={user.es_beneficiario ? 'Tarifa Actual' : 'Gasto Este Mes'}
        value={user.es_beneficiario ? '$0' : valor(resumen?.gastoMes, pesos)}
        subtitle={
          user.es_beneficiario
            ? 'Beneficiario: almuerzo 100% subsidiado'
            : resumen && resumen.pendientePago > 0
              ? `Pendiente por pagar: ${pesos(resumen.pendientePago)}`
              : 'Todo pagado'
        }
        icon={<DollarSign className="size-5" />}
        tone="warning"
      />
      <StatCard
        title="Ficha & Documento"
        value={user.ficha || 'Sin ficha'}
        subtitle={`C.C. ${user.document}`}
        icon={<IdCard className="size-5" />}
        tone="accent"
      />
    </div>
  );
};

export const StatsHeader = ({ user }: StatsHeaderProps) => {
  switch (user.role) {
    case 'encargado':
      return <StatsEncargado />;
    case 'coordinador':
      return <StatsCoordinador />;
    case 'instructor':
      return <StatsInstructor user={user} />;
    default:
      return <StatsAprendiz user={user} />;
  }
};
