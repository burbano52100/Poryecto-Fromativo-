import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Alert, Card } from '@heroui/react';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { FormField } from '../molecules/FormField';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SectionCard } from '../molecules/SectionCard';
import { SelectField } from '../molecules/SelectField';
import {
  useEliminarAlmuerzoInvitado,
  useHistorialAlmuerzosInvitados,
  useResumenAlmuerzosInvitados,
  useTarifasAlmuerzosInvitados,
} from '../../hooks/useAlmuerzosInvitados';
import { ETIQUETA_TIPO_INVITADO, TIPOS_ALMUERZO_INVITADO, textoPersonas } from '../../schemas/almuerzosInvitados.schema';
import { fechaHora, hoyBogota, inicioMesBogota, pesos } from '../../lib/formato';
import type { AlmuerzoInvitado, TipoAlmuerzoInvitado } from '../../types/api';
import { RegistroAlmuerzoInvitadoCard } from './almuerzosInvitados/RegistroAlmuerzoInvitadoCard';
import { ResumenAlmuerzosInvitados } from './almuerzosInvitados/ResumenAlmuerzosInvitados';
import { HistorialAlmuerzosInvitados } from './almuerzosInvitados/HistorialAlmuerzosInvitados';
import { EditarAlmuerzoInvitadoModal } from './almuerzosInvitados/EditarAlmuerzoInvitadoModal';

/** Error del rango de fechas, o null si es válido. */
const validarRango = (desde: string, hasta: string): string | null => {
  if (!desde || !hasta) return 'Selecciona la fecha inicial y la final.';
  if (desde > hasta) return 'La fecha inicial no puede ser posterior a la fecha final.';
  return null;
};

/**
 * Almuerzos Invitados (Encargado, ADR 016): tres tipos con tarifa fija. El encargado indica
 * cuántas personas son y el total se calcula en vivo. Los registros suman en Ventas e Ingresos.
 */
export const AlmuerzosInvitadosSection = () => {
  const tarifas = useTarifasAlmuerzosInvitados();
  const hoy = hoyBogota();
  const [desde, setDesde] = useState(inicioMesBogota);
  const [hasta, setHasta] = useState(hoy);
  const [tipo, setTipo] = useState<TipoAlmuerzoInvitado | ''>('');
  const errorRango = validarRango(desde, hasta);

  const historial = useHistorialAlmuerzosInvitados({ desde, hasta, tipo: tipo || undefined }, !errorRango);
  const resumen = useResumenAlmuerzosInvitados({ desde, hasta }, !errorRango);

  const [editando, setEditando] = useState<AlmuerzoInvitado | null>(null);
  const [eliminando, setEliminando] = useState<AlmuerzoInvitado | null>(null);
  const eliminar = useEliminarAlmuerzoInvitado();

  const confirmarEliminacion = () => {
    if (!eliminando) return;
    eliminar.mutate(eliminando.id, { onSettled: () => setEliminando(null) });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">Registrar almuerzos invitados</h3>
        <p className="text-sm text-muted">
          Indica cuántas personas almuerzan como invitadas en cada tipo. El total usa la tarifa fija y se suma a Ventas
          e Ingresos.
        </p>
      </div>

      {tarifas.isPending ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="gap-4 p-5">
              <ListSkeleton label="Cargando tarifas..." filas={2} />
            </Card>
          ))}
        </div>
      ) : tarifas.isError ? (
        <ErrorAlert error={tarifas.error} titulo="No se pudieron cargar las tarifas" onReintentar={() => tarifas.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {tarifas.data.tarifas.map((tarifa) => (
            <RegistroAlmuerzoInvitadoCard
              key={tarifa.tipo}
              tipo={tarifa.tipo}
              precio={tarifa.precio}
              maxPersonas={tarifas.data.maxPersonas}
            />
          ))}
        </div>
      )}

      <SectionCard titulo="Período" descripcion="Filtra el resumen y el historial por rango de fechas">
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField
            id="invitados-desde"
            label="Desde"
            type="date"
            value={desde}
            max={hasta || hoy}
            onChange={(e) => setDesde(e.target.value)}
          />
          <FormField
            id="invitados-hasta"
            label="Hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            max={hoy}
            onChange={(e) => setHasta(e.target.value)}
          />
          <SelectField
            label="Tipo (historial)"
            value={tipo || 'todos'}
            onChange={(v) => setTipo(v === 'todos' ? '' : (v as TipoAlmuerzoInvitado))}
            opciones={[
              { id: 'todos', label: 'Todos' },
              ...TIPOS_ALMUERZO_INVITADO.map((t) => ({ id: t, label: ETIQUETA_TIPO_INVITADO[t].corto })),
            ]}
          />
        </div>
        {errorRango && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{errorRango}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </SectionCard>

      {!errorRango &&
        (resumen.isPending ? (
          <Card>
            <ListSkeleton label="Calculando resumen..." forma="tabla" filas={3} />
          </Card>
        ) : resumen.isError ? (
          <ErrorAlert error={resumen.error} titulo="No se pudo calcular el resumen" onReintentar={() => resumen.refetch()} />
        ) : (
          <ResumenAlmuerzosInvitados resumen={resumen.data} />
        ))}

      <SectionCard titulo="Historial de registros">
        {eliminar.isError && (
          <ErrorAlert error={eliminar.error} titulo="No se pudo eliminar el registro" onCerrar={() => eliminar.reset()} />
        )}

        {errorRango ? (
          <EmptyMessage>Corrige el rango de fechas para ver el historial.</EmptyMessage>
        ) : historial.isPending ? (
          <ListSkeleton label="Cargando historial..." forma="tabla" />
        ) : historial.isError ? (
          <ErrorAlert error={historial.error} titulo="No se pudo cargar el historial" onReintentar={() => historial.refetch()} />
        ) : (
          <HistorialAlmuerzosInvitados registros={historial.data} onEditar={setEditando} onEliminar={setEliminando} />
        )}
      </SectionCard>

      {editando && tarifas.data && (
        <EditarAlmuerzoInvitadoModal
          key={editando.id}
          registro={editando}
          maxPersonas={tarifas.data.maxPersonas}
          onCerrar={() => setEditando(null)}
        />
      )}

      <ConfirmDialog
        abierto={!!eliminando}
        titulo="¿Eliminar este registro?"
        icono={<Trash2 className="size-5" />}
        variante="danger"
        textoConfirmar="Eliminar"
        cargando={eliminar.isPending}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setEliminando(null)}
      >
        {eliminando && (
          <p>
            Se eliminará el registro de <strong>{textoPersonas(eliminando.cantidad)}</strong> (
            {ETIQUETA_TIPO_INVITADO[eliminando.tipo].corto}) por <strong>{pesos(eliminando.total)}</strong> del{' '}
            {fechaHora(eliminando.fecha_hora)}. Esta acción no se puede deshacer y el valor sale de Ventas.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
};
