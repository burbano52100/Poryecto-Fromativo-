import { useState } from 'react';
import { Users, BookOpen, ChevronDown, Search, Utensils, Award } from 'lucide-react';
import { LoadingSpinner } from '../atoms/LoadingSpinner';
import { EstadoPagoBadge } from '../atoms/EstadoPagoBadge';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { useAprendicesDeGrupo, useGrupos, useMarcarPagoAprendiz } from '../../hooks/useGrupos';
import { pesos } from '../../lib/formato';
import type { Grupo } from '../../types/api';

/** Aprendices de la ficha que reservaron hoy, con su control de pago. */
const AprendicesDelGrupo = ({ grupo }: { grupo: Grupo }) => {
  const { data, isPending, isError, error, refetch } = useAprendicesDeGrupo(grupo.id, true);
  const marcarPago = useMarcarPagoAprendiz();

  if (isPending) return <LoadingSpinner label="Cargando reservas de hoy..." />;
  if (isError) return <ErrorAlert error={error} titulo="No se pudieron cargar los aprendices" onReintentar={() => refetch()} />;

  if (data.aprendices.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">Ningún aprendiz de esta ficha ha reservado almuerzo hoy.</p>;
  }

  return (
    <div className="space-y-2">
      {marcarPago.isError && (
        <ErrorAlert error={marcarPago.error} titulo="No se pudo cambiar el estado de pago" onCerrar={() => marcarPago.reset()} />
      )}
      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
        {data.aprendices.map((aprendiz) => {
          const actualizando = marcarPago.isPending && marcarPago.variables?.ventaId === aprendiz.venta_id;
          return (
            <li key={aprendiz.venta_id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  {aprendiz.name}
                  {aprendiz.es_beneficiario && <Award className="w-3.5 h-3.5 text-amber-500" aria-label="Beneficiario" />}
                </p>
                <p className="text-xs text-gray-500">
                  C.C. {aprendiz.document} · {pesos(aprendiz.precio)}
                </p>
              </div>

              {aprendiz.estado_pago === 'gratis' ? (
                <EstadoPagoBadge estado="gratis" />
              ) : (
                <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50" role="group" aria-label={`Pago de ${aprendiz.name}`}>
                  {[true, false].map((pagado) => {
                    const activo = (aprendiz.estado_pago === 'pagado') === pagado;
                    return (
                      <button
                        key={String(pagado)}
                        type="button"
                        aria-pressed={activo}
                        disabled={actualizando || activo}
                        onClick={() => marcarPago.mutate({ ventaId: aprendiz.venta_id, pagado })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer disabled:cursor-default ${
                          activo
                            ? pagado
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-red-600 text-white shadow-xs'
                            : 'text-gray-600 hover:bg-white'
                        } ${actualizando ? 'opacity-60' : ''}`}
                      >
                        {pagado ? 'Pagado' : 'No pagado'}
                      </button>
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

/** Cifra del día en la fila de una ficha. */
const Cifra = ({ valor, etiqueta, colores }: { valor: number; etiqueta: string; colores: string }) => (
  <div className={`flex-1 min-w-0 lg:flex-none lg:w-[5.5rem] rounded-xl border px-2 py-2 text-center ${colores}`}>
    <p className="text-xl font-black leading-none">{valor}</p>
    <p className="text-[11px] font-semibold mt-1 leading-tight">{etiqueta}</p>
  </div>
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
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-green-600" />
              Gestión de Grupos y Fichas SENA
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              De la ficha que más reservó hoy a la que menos. Toca una para ver quién reservó y registrar su pago
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            <input
              type="search"
              aria-label="Buscar grupo"
              placeholder="Buscar por ficha, programa o instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Grupos</p>
              <p className="text-2xl font-black text-emerald-950 mt-0.5">{grupos.length} Fichas</p>
            </div>
          </div>
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Aprendices Registrados</p>
              <p className="text-2xl font-black text-blue-950 mt-0.5">{totalAprendices}</p>
            </div>
          </div>
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Reservas de Hoy</p>
              <p className="text-2xl font-black text-amber-950 mt-0.5">{reservasHoy}</p>
              <p className="text-xs font-semibold text-amber-800">{pendientesHoy} sin pagar</p>
            </div>
          </div>
        </div>

        {isPending ? (
          <LoadingSpinner label="Cargando grupos..." />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar los grupos" onReintentar={() => refetch()} />
        ) : filteredGrupos.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No hay fichas que coincidan con la búsqueda.</p>
        ) : (
          <ol className="space-y-3 pt-2" aria-label="Fichas ordenadas por reservas de hoy">
            {filteredGrupos.map((grupo, posicion) => {
              const abierto = grupoAbierto === grupo.id;
              return (
                <li
                  key={grupo.id}
                  className={`rounded-2xl border transition duration-200 ${
                    abierto
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-md'
                      : 'bg-gray-50/80 border-gray-200/80 hover:border-emerald-300 hover:shadow-md'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={abierto}
                    aria-controls={`aprendices-${grupo.id}`}
                    onClick={() => setGrupoAbierto(abierto ? null : grupo.id)}
                    className="w-full text-left p-4 sm:p-5 cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 flex flex-col lg:flex-row lg:items-center gap-4"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-sm font-black text-gray-500 flex items-center justify-center shrink-0">
                        {posicion + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                            Ficha {grupo.ficha}
                          </span>
                          <span className="text-xs font-semibold text-gray-400">Jornada {grupo.shift}</span>
                        </div>
                        <h3 className="text-base font-extrabold text-gray-900 mt-1.5 leading-snug">{grupo.program}</h3>
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-bold text-gray-800">Instructor:</span> {grupo.instructor ?? 'Sin asignar'}
                          <span className="text-gray-300"> · </span>
                          {grupo.studentsCount} aprendices registrados
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                      <Cifra valor={grupo.reservasHoy} etiqueta="Reservas hoy" colores="bg-white border-gray-200 text-gray-900" />
                      <Cifra
                        valor={grupo.pagadosHoy + grupo.gratisHoy}
                        etiqueta="Al día"
                        colores={
                          grupo.pagadosHoy + grupo.gratisHoy > 0
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-white border-gray-200 text-gray-400'
                        }
                      />
                      <Cifra
                        valor={grupo.pendientesHoy}
                        etiqueta="Sin pagar"
                        colores={
                          grupo.pendientesHoy > 0
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-white border-gray-200 text-gray-400'
                        }
                      />
                      <span className="p-2 rounded-xl bg-white border border-gray-200 text-emerald-700 ml-1">
                        <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
                      </span>
                    </div>
                  </button>

                  {abierto && (
                    <div id={`aprendices-${grupo.id}`} className="px-4 sm:px-5 pb-5">
                      <AprendicesDelGrupo grupo={grupo} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};
