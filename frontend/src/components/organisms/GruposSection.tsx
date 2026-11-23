import { useState } from 'react';
import { Award, ChevronDown } from 'lucide-react';
import { Chip, Separator, ToggleButton } from '@heroui/react';
import { EstadoPagoBadge } from '../atoms/EstadoPagoBadge';
import { FranjaCifras } from '../molecules/FranjaCifras';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SearchInput } from '../molecules/SearchInput';
import { SectionCard } from '../molecules/SectionCard';
import { useAprendicesDeGrupo, useGrupos, useMarcarPagoAprendiz } from '../../hooks/useGrupos';
import { pesos } from '../../lib/formato';
import type { Grupo } from '../../types/api';

/** Aprendices de la ficha que reservaron hoy, con su control de pago. */
const AprendicesDelGrupo = ({ grupo }: { grupo: Grupo }) => {
  const { data, isPending, isError, error, refetch } = useAprendicesDeGrupo(grupo.id, true);
  const marcarPago = useMarcarPagoAprendiz();

  if (isPending) return <ListSkeleton label="Cargando reservas de hoy..." filas={2} />;
  if (isError) return <ErrorAlert error={error} titulo="No se pudieron cargar los aprendices" onReintentar={() => refetch()} />;

  if (data.aprendices.length === 0) {
    return <EmptyMessage>Ningún aprendiz de esta ficha ha reservado almuerzo hoy.</EmptyMessage>;
  }

  return (
    <div className="flex flex-col gap-2">
      {marcarPago.isError && (
        <ErrorAlert error={marcarPago.error} titulo="No se pudo cambiar el estado de pago" onCerrar={() => marcarPago.reset()} />
      )}
      <ul className="divide-y divide-separator rounded-xl bg-surface">
        {data.aprendices.map((aprendiz) => {
          const actualizando = marcarPago.isPending && marcarPago.variables?.ventaId === aprendiz.venta_id;
          return (
            <li key={aprendiz.venta_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {aprendiz.name}
                  {aprendiz.es_beneficiario && <Award className="size-3.5 text-warning" aria-label="Beneficiario" />}
                </p>
                <p className="text-xs text-muted">
                  C.C. {aprendiz.document} · {pesos(aprendiz.precio)}
                </p>
              </div>

              {aprendiz.estado_pago === 'gratis' ? (
                <EstadoPagoBadge estado="gratis" />
              ) : (
                <div role="group" aria-label={`Pago de ${aprendiz.name}`} className="flex gap-1 rounded-full bg-default p-0.5">
                  {[true, false].map((pagado) => {
                    const activo = (aprendiz.estado_pago === 'pagado') === pagado;
                    return (
                      <ToggleButton
                        key={String(pagado)}
                        size="sm"
                        isSelected={activo}
                        isDisabled={actualizando || activo}
                        onChange={() => marcarPago.mutate({ ventaId: aprendiz.venta_id, pagado })}
                        className={
                          activo
                            ? pagado
                              ? 'bg-success text-success-foreground'
                              : 'bg-danger text-danger-foreground'
                            : 'bg-transparent'
                        }
                      >
                        {pagado ? 'Pagado' : 'No pagado'}
                      </ToggleButton>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** De la ficha que más reservó hoy a la que menos; a igual número, primero la que más debe. */
const ordenarPorReservas = (grupos: Grupo[]): Grupo[] =>
  [...grupos].sort(
    (a, b) =>
      b.reservasHoy - a.reservasHoy ||
      b.pendientesHoy - a.pendientesHoy ||
      a.ficha.localeCompare(b.ficha, 'es', { numeric: true })
  );

/**
 * Grupos y fichas, una por fila y ordenadas por reservas de hoy. Al hacer clic en una ficha se
 * despliegan los aprendices que reservaron hoy y se marca Pagado / No pagado; los instructores
 * se cobran en Cartera de Deudas.
 */
export const GruposSection = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);
  const { data: grupos = [], isPending, isError, error, refetch } = useGrupos();

  const termino = searchTerm.toLowerCase();
  const filteredGrupos = ordenarPorReservas(grupos).filter(
    (g) =>
      g.ficha.includes(searchTerm) ||
      g.program.toLowerCase().includes(termino) ||
      (g.instructor ?? '').toLowerCase().includes(termino)
  );

  const totalAprendices = grupos.reduce((n, g) => n + g.studentsCount, 0);
  const reservasHoy = grupos.reduce((n, g) => n + g.reservasHoy, 0);
  const pendientesHoy = grupos.reduce((n, g) => n + g.pendientesHoy, 0);

  return (
    <div className="flex flex-col gap-6">
      <FranjaCifras
        etiqueta="Resumen de grupos"
        cifras={[
          { etiqueta: 'Fichas', valor: isPending ? undefined : grupos.length },
          { etiqueta: 'Aprendices', valor: isPending ? undefined : totalAprendices },
          {
            etiqueta: 'Reservas de hoy',
            valor: isPending ? undefined : reservasHoy,
            detalle: isPending ? undefined : pendientesHoy > 0 ? `${pendientesHoy} sin pagar` : 'Todas pagadas',
          },
        ]}
      />

      <SectionCard
        titulo="Grupos y fichas"
        descripcion="De la ficha que más reservó hoy a la que menos. Toca una para ver quién reservó y registrar su pago."
        acciones={
          <SearchInput
            label="Buscar grupo"
            placeholder="Buscar por ficha, programa o instructor"
            value={searchTerm}
            onChange={setSearchTerm}
            className="w-full sm:w-80"
          />
        }
      >
        {isPending ? (
          <ListSkeleton label="Cargando grupos..." />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar los grupos" onReintentar={() => refetch()} />
        ) : filteredGrupos.length === 0 ? (
          <EmptyMessage>No hay fichas que coincidan con la búsqueda.</EmptyMessage>
        ) : (
          <ol className="flex flex-col gap-2" aria-label="Fichas ordenadas por reservas de hoy">
            {filteredGrupos.map((grupo, posicion) => {
              const abierto = grupoAbierto === grupo.id;
              const alDia = grupo.pagadosHoy + grupo.gratisHoy;
              return (
                <li
                  key={grupo.id}
                  className={`rounded-xl transition-colors ${abierto ? 'bg-surface-secondary' : 'hover:bg-surface-secondary'}`}
                >
                  <button
                    type="button"
                    aria-expanded={abierto}
                    aria-controls={`aprendices-${grupo.id}`}
                    onClick={() => setGrupoAbierto(abierto ? null : grupo.id)}
                    className="flex w-full cursor-pointer flex-col gap-3 rounded-xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus lg:flex-row lg:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-default text-xs font-medium text-muted">
                        {posicion + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip size="sm" variant="soft" color="accent">
                            Ficha {grupo.ficha}
                          </Chip>
                          <span className="text-xs text-muted">Jornada {grupo.shift}</span>
                        </div>
                        <h3 className="mt-1 font-medium text-foreground">{grupo.program}</h3>
                        <p className="mt-0.5 text-xs text-muted">
                          Instructor: {grupo.instructor ?? 'Sin asignar'} · {grupo.studentsCount} aprendices registrados
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Chip size="sm" variant="secondary">
                        {grupo.reservasHoy} reservas hoy
                      </Chip>
                      <Chip size="sm" variant="soft" color={alDia > 0 ? 'success' : 'default'}>
                        {alDia} al día
                      </Chip>
                      <Chip size="sm" variant="soft" color={grupo.pendientesHoy > 0 ? 'danger' : 'default'}>
                        {grupo.pendientesHoy} sin pagar
                      </Chip>
                      <ChevronDown className={`ml-1 size-4 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {abierto && (
                    <div id={`aprendices-${grupo.id}`} className="px-4 pb-4">
                      <Separator className="mb-3" />
                      <AprendicesDelGrupo grupo={grupo} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </SectionCard>
    </div>
  );
};
