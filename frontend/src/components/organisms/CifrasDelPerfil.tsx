import { useResumenConsumos } from '../../hooks/useConsumos';
import { useMiCuenta } from '../../hooks/useCartera';
import { useResumenEncargado } from '../../hooks/useVentas';
import { useResumenCoordinador } from '../../hooks/useCoordinador';
import { pesos } from '../../lib/formato';
import { FranjaCifras } from '../molecules/FranjaCifras';

/*
 * Cifras de cada perfil, cada una en la sección a la que pertenece (antes iban todas juntas
 * encima de cada sección). Las destacadas usan el color del perfil y abren su sección.
 */

/** `undefined` mientras carga (la cifra muestra un Skeleton) y el valor formateado cuando llega. */
const valor = <T,>(dato: T | undefined, formato: (v: T) => string | number) =>
  dato === undefined ? undefined : formato(dato);

/** Encargado · Ventas: solo las ventas de hoy. La deuda vive en Cartera y las sugerencias en el Buzón. */
export const CifrasVentasHoy = () => {
  const { data } = useResumenEncargado();
  return (
    <FranjaCifras
      etiqueta="Ventas de hoy"
      titulo="Ventas de hoy"
      destacada
      cifras={[
        {
          etiqueta: 'Almuerzos servidos',
          valor: valor(data?.ventasHoy, (n) => n),
          detalle: data
            ? `Incluye ${data.invitadosHoy} de invitados` + (data.especialesHoy ? ` y ${data.especialesHoy} especiales` : '')
            : undefined,
        },
        {
          etiqueta: 'Cobrado',
          valor: valor(data?.ingresosHoy, pesos),
          detalle: data?.ingresosEspecialesHoy ? 'Reservas, invitados y especiales pagados hoy' : 'Reservas pagadas e invitados',
        },
        {
          etiqueta: 'Por cobrar',
          valor: valor(data?.porCobrarHoy, pesos),
          detalle: data ? (data.porCobrarHoy > 0 ? 'Reservas de hoy sin pagar' : 'Nada pendiente') : undefined,
        },
      ]}
    />
  );
};

/** Coordinador · Solicitudes: cuántas cuentas esperan aprobación. */
export const CifrasSolicitudes = () => {
  const { data } = useResumenCoordinador();
  const pendientes = data?.pendientes ?? 0;
  return (
    <FranjaCifras
      etiqueta="Solicitudes por aprobar"
      destacada
      cifras={[
        {
          etiqueta: 'Solicitudes por aprobar',
          valor: valor(data?.pendientes, (n) => n),
          detalle: data ? (pendientes > 0 ? 'Cuentas nuevas de instructores y aprendices' : 'Ninguna cuenta espera aprobación') : undefined,
        },
      ]}
    />
  );
};

/** Coordinador · Usuarios: las cuentas activas del centro, por rol. */
export const CifrasCuentasActivas = () => {
  const { data } = useResumenCoordinador();
  return (
    <FranjaCifras
      etiqueta="Cuentas activas"
      cifras={[
        { etiqueta: 'Cuentas activas', valor: valor(data?.activos, (n) => n) },
        { etiqueta: 'Instructores', valor: valor(data?.instructores, (n) => n) },
        { etiqueta: 'Aprendices', valor: valor(data?.aprendices, (n) => n) },
      ]}
    />
  );
};

/** Instructor · Mi cuenta: lo que debe del mes, que es lo que viene a mirar aquí. */
export const CifrasCuentaInstructor = () => {
  const { data: cuenta } = useMiCuenta();
  const { data: resumen } = useResumenConsumos();
  const pendiente = cuenta?.pendingBalance ?? 0;
  return (
    <FranjaCifras
      etiqueta="Tu cuenta del mes"
      titulo="Tu cuenta del mes"
      destacada
      cifras={[
        {
          etiqueta: 'Saldo por pagar',
          valor: valor(cuenta?.pendingBalance, pesos),
          estado: cuenta ? (pendiente > 0 ? { texto: 'Pendiente', color: 'warning' } : { texto: 'Al día', color: 'success' }) : undefined,
          detalle: cuenta ? (pendiente > 0 ? 'Se paga en la oficina del comedor' : 'No debes nada') : undefined,
        },
        { etiqueta: 'Almuerzos este mes', valor: valor(cuenta?.monthlyLunches, (n) => n), detalle: 'Se pagan a fin de mes' },
        { etiqueta: 'Consumo total', valor: valor(resumen?.gastoTotal, pesos), detalle: 'Desde que usas el comedor' },
      ]}
    />
  );
};

/** Aprendiz · Mis fichas: cuánto lleva el mes y si debe algo en la ventanilla. */
export const CifrasFichasAprendiz = ({ esBeneficiario = false }: { esBeneficiario?: boolean }) => {
  const { data: resumen } = useResumenConsumos();
  const pendiente = resumen?.pendientePago ?? 0;
  return (
    <FranjaCifras
      etiqueta="Tu mes"
      titulo="Tu mes"
      destacada
      cifras={[
        esBeneficiario
          ? { etiqueta: 'Tu almuerzo', valor: '$0', detalle: 'Eres beneficiario del subsidio' }
          : {
              etiqueta: 'Por pagar',
              valor: valor(resumen?.pendientePago, pesos),
              estado: resumen ? (pendiente > 0 ? { texto: 'Pendiente', color: 'warning' } : { texto: 'Al día', color: 'success' }) : undefined,
              detalle: resumen ? (pendiente > 0 ? 'Págalo en la ventanilla del comedor' : 'No debes nada') : undefined,
            },
        {
          etiqueta: 'Almuerzos este mes',
          valor: valor(resumen?.almuerzosMes, (n) => n),
          detalle: resumen ? `${resumen.totalAlmuerzos} en total` : undefined,
        },
        ...(esBeneficiario
          ? []
          : [{ etiqueta: 'Gasto este mes', valor: valor(resumen?.gastoMes, pesos), detalle: 'Reservas de este mes' }]),
      ]}
    />
  );
};
