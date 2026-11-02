import { Utensils, Calendar, DollarSign, IdCard, CreditCard, ShoppingCart, Mail, Heart, MapPin, Clock } from 'lucide-react';
import { StatCard } from '../atoms/StatCard';
import type { User } from '../../schemas/auth.schema';
import { useResumenConsumos } from '../../hooks/useConsumos';
import { useMiCuenta } from '../../hooks/useCartera';
import { useResumenEncargado } from '../../hooks/useVentas';
import { useMenuActivo } from '../../hooks/useMenu';
import { pesos } from '../../lib/formato';

export interface StatsHeaderProps {
  user: User;
}

const GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6';

/** Muestra "…" mientras carga y el valor formateado cuando llega. */
const valor = <T,>(dato: T | undefined, formato: (v: T) => string | number) =>
  dato === undefined ? '…' : formato(dato);

const StatsEncargado = () => {
  const { data } = useResumenEncargado();
  return (
    <div className={GRID}>
      <StatCard
        title="Ventas de Hoy"
        value={valor(data?.ventasHoy, (n) => `${n} almuerzos`)}
        subtitle="Reservas registradas hoy"
        icon={<ShoppingCart className="w-6 h-6" />}
        variant="green"
        badgeText="Hoy"
      />
      <StatCard
        title="Ingresos de Hoy"
        value={valor(data?.ingresosHoy, pesos)}
        subtitle={data ? `Por cobrar hoy: ${pesos(data.porCobrarHoy)}` : 'Solo almuerzos pagados'}
        icon={<DollarSign className="w-6 h-6" />}
        variant="emerald"
        badgeText="Cobrado"
      />
      <StatCard
        title="Deudas Pendientes"
        value={valor(data?.deudasPendientes.monto, pesos)}
        subtitle={data ? `${data.deudasPendientes.cantidad} cuenta(s) por cobrar` : 'Cartera de instructores'}
        icon={<CreditCard className="w-6 h-6" />}
        variant="amber"
        badgeText="Por Cobrar"
      />
      <StatCard
        title="Sugerencias"
        value={valor(data?.sugerenciasPendientes, (n) => `${n} pendiente${n === 1 ? '' : 's'}`)}
        subtitle="Buzón de atención"
        icon={<Mail className="w-6 h-6" />}
        variant="blue"
        badgeText="Revisión"
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
        icon={<Calendar className="w-6 h-6" />}
        variant="emerald"
        badgeText="Consumos"
      />
      <StatCard
        title="Saldo Pendiente"
        value={valor(cuenta?.pendingBalance, pesos)}
        subtitle={pendiente > 0 ? 'Por cancelar en oficina' : 'Cuenta al día'}
        icon={<CreditCard className="w-6 h-6" />}
        variant={pendiente > 0 ? 'amber' : 'green'}
        badgeText={pendiente > 0 ? 'Pendiente' : 'Al día'}
      />
      <StatCard
        title="Total Consumido"
        value={valor(resumen?.gastoTotal, pesos)}
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
};

const StatsAprendiz = ({ user }: StatsHeaderProps) => {
  const { data: resumen } = useResumenConsumos();
  return (
    <div className={GRID}>
      <StatCard
        title="Total Almuerzos"
        value={valor(resumen?.totalAlmuerzos, (n) => n)}
        subtitle="Historial acumulado"
        icon={<Utensils className="w-6 h-6" />}
        variant="green"
        badgeText="Reservados"
      />
      <StatCard
        title="Almuerzos Este Mes"
        value={valor(resumen?.almuerzosMes, (n) => n)}
        subtitle="Mes actual"
        icon={<Calendar className="w-6 h-6" />}
        variant="emerald"
        badgeText="Fichas"
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
        icon={<DollarSign className="w-6 h-6" />}
        variant="amber"
      />
      <StatCard
        title="Ficha & Documento"
        value={user.ficha || 'Sin ficha'}
        subtitle={`C.C. ${user.document}`}
        icon={<IdCard className="w-6 h-6" />}
        variant="blue"
      />
    </div>
  );
};

const StatsInvitado = () => {
  const { data: menu } = useMenuActivo();
  const abierto = menu?.horario.abierto ?? false;
  return (
    <div className={GRID}>
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
        value={valor(menu?.precio_invitado, pesos)}
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
        title="Horario de Reservas"
        value={menu ? `${menu.horario.abre} - ${menu.horario.cierra}` : '…'}
        subtitle={abierto ? 'Reservas abiertas ahora' : 'Reservas cerradas en este momento'}
        icon={<Clock className="w-6 h-6" />}
        variant="blue"
        badgeText={abierto ? 'Abierto' : 'Cerrado'}
      />
    </div>
  );
};

export const StatsHeader = ({ user }: StatsHeaderProps) => {
  switch (user.role) {
    case 'encargado':
      return <StatsEncargado />;
    case 'instructor':
      return <StatsInstructor user={user} />;
    case 'invitado':
      return <StatsInvitado />;
    default:
      return <StatsAprendiz user={user} />;
  }
};
