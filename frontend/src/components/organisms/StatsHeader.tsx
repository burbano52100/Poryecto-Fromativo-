import type { User } from '../../schemas/auth.schema';
import { useResumenConsumos } from '../../hooks/useConsumos';
import { useMiCuenta } from '../../hooks/useCartera';
import { useResumenEncargado } from '../../hooks/useVentas';
import { useResumenCoordinador } from '../../hooks/useCoordinador';
import { pesos } from '../../lib/formato';
import { FranjaCifras, type Cifra } from '../molecules/FranjaCifras';
import type { SectionType } from './Sidebar';

export interface StatsHeaderProps {
  user: User;
  activeSection?: SectionType;
  onSelectSection?: (section: SectionType) => void;
}

/** `undefined` mientras carga (la cifra muestra un Skeleton) y el valor formateado cuando llega. */
const valor = <T,>(dato: T | undefined, formato: (v: T) => string | number) =>
  dato === undefined ? undefined : formato(dato);

/** "1 cuenta", "3 cuentas". */
const contar = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

/**
 * Botón que lleva a la sección donde se resuelve la cifra. No aparece si ya se está en esa
 * sección o si no hay nada que hacer.
 */
const ir = (
  { activeSection, onSelectSection }: StatsHeaderProps,
  destino: SectionType,
  texto: string,
  hayQueHacer: boolean
): Cifra['accion'] =>
  onSelectSection && hayQueHacer && activeSection !== destino ? { texto, onPress: () => onSelectSection(destino) } : undefined;

const Franja = ({ cifras }: { cifras: Cifra[] }) => (
  <FranjaCifras etiqueta="Resumen" cifras={cifras} className="mb-6" />
);

const StatsEncargado = (props: StatsHeaderProps) => {
  const { data } = useResumenEncargado();
  const deudas = data?.deudasPendientes.cantidad ?? 0;
  const sugerencias = data?.sugerenciasPendientes ?? 0;
  return (
    <Franja
      cifras={[
        {
          etiqueta: 'Almuerzos de hoy',
          valor: valor(data?.ventasHoy, (n) => n),
          detalle: data ? `Incluye ${data.invitadosHoy} de invitados` : undefined,
        },
        {
          etiqueta: 'Cobrado hoy',
          valor: valor(data?.ingresosHoy, pesos),
          detalle: data
            ? data.porCobrarHoy > 0
              ? `Faltan ${pesos(data.porCobrarHoy)} por cobrar`
              : 'Nada pendiente por cobrar'
            : undefined,
        },
        {
          etiqueta: 'Deuda de instructores',
          valor: valor(data?.deudasPendientes.monto, pesos),
          detalle: data ? `${contar(deudas, 'cuenta', 'cuentas')} por cobrar` : undefined,
          accion: ir(props, 'deudas', 'Ver cartera', deudas > 0),
        },
        {
          etiqueta: 'Sugerencias sin responder',
          valor: valor(data?.sugerenciasPendientes, (n) => n),
          accion: ir(props, 'sugerencias', 'Responder', sugerencias > 0),
        },
      ]}
    />
  );
};

const StatsCoordinador = (props: StatsHeaderProps) => {
  const { data } = useResumenCoordinador();
  const pendientes = data?.pendientes ?? 0;
  return (
    <Franja
      cifras={[
        {
          etiqueta: 'Solicitudes por aprobar',
          valor: valor(data?.pendientes, (n) => n),
          detalle: data ? (pendientes > 0 ? 'Cuentas nuevas de instructores y aprendices' : 'Ninguna cuenta espera aprobación') : undefined,
          accion: ir(props, 'solicitudes', 'Revisar', pendientes > 0),
        },
        {
          etiqueta: 'Cuentas activas',
          valor: valor(data?.activos, (n) => n),
          detalle: data
            ? `${contar(data.instructores, 'instructor', 'instructores')} y ${contar(data.aprendices, 'aprendiz', 'aprendices')}`
            : undefined,
        },
      ]}
    />
  );
};

const StatsInstructor = (props: StatsHeaderProps) => {
  const { data: cuenta } = useMiCuenta();
  const { data: resumen } = useResumenConsumos();
  const pendiente = cuenta?.pendingBalance ?? 0;
  return (
    <Franja
      cifras={[
        {
          etiqueta: 'Almuerzos este mes',
          valor: valor(cuenta?.monthlyLunches, (n) => n),
          detalle: 'Se pagan a fin de mes',
        },
        {
          etiqueta: 'Saldo por pagar',
          valor: valor(cuenta?.pendingBalance, pesos),
          estado: cuenta ? (pendiente > 0 ? { texto: 'Pendiente', color: 'warning' } : { texto: 'Al día', color: 'success' }) : undefined,
          detalle: cuenta ? (pendiente > 0 ? 'Se paga en la oficina del comedor' : 'No debes nada') : undefined,
          accion: ir(props, 'cuenta', 'Ver mi cuenta', true),
        },
        {
          etiqueta: 'Consumo total',
          valor: valor(resumen?.gastoTotal, pesos),
          detalle: 'Desde que usas el comedor',
        },
      ]}
    />
  );
};

const StatsAprendiz = (props: StatsHeaderProps) => {
  const { data: resumen } = useResumenConsumos();
  const pendiente = resumen?.pendientePago ?? 0;
  const beneficiario = props.user.es_beneficiario;
  return (
    <Franja
      cifras={[
        {
          etiqueta: 'Almuerzos este mes',
          valor: valor(resumen?.almuerzosMes, (n) => n),
          detalle: resumen ? `${resumen.totalAlmuerzos} en total` : undefined,
        },
        beneficiario
          ? { etiqueta: 'Tu almuerzo', valor: '$0', detalle: 'Eres beneficiario del subsidio' }
          : {
              etiqueta: 'Gasto este mes',
              valor: valor(resumen?.gastoMes, pesos),
              estado: pendiente > 0 ? { texto: 'Pendiente', color: 'warning' } : undefined,
              detalle: resumen ? (pendiente > 0 ? `Debes ${pesos(pendiente)} en la ventanilla` : 'Todo pagado') : undefined,
              accion: ir(props, 'fichas', 'Ver mis fichas', pendiente > 0),
            },
      ]}
    />
  );
};

/** Cifras del rol arriba de cada sección del panel, con un botón a donde se resuelven. */
export const StatsHeader = (props: StatsHeaderProps) => {
  switch (props.user.role) {
    case 'encargado':
      return <StatsEncargado {...props} />;
    case 'coordinador':
      return <StatsCoordinador {...props} />;
    case 'instructor':
      return <StatsInstructor {...props} />;
    default:
      return <StatsAprendiz {...props} />;
  }
};
