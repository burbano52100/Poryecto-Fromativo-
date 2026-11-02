import { useState } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, Clock, Download, Award } from 'lucide-react';
import { LoadingSpinner } from '../atoms/LoadingSpinner';
import { EstadoPagoBadge } from '../atoms/EstadoPagoBadge';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { useReporteVentas } from '../../hooks/useVentas';
import { fechaHora, pesos } from '../../lib/formato';
import { descargarCsv } from '../../lib/csv';
import type { PeriodoVentas } from '../../types/api';

const PERIODOS: PeriodoVentas[] = ['Día', 'Semana', 'Mes', 'Trimestre', 'Semestre', 'Año'];

const DESCRIPCION_PERIODO: Record<PeriodoVentas, string> = {
  Día: 'hoy',
  Semana: 'esta semana (desde el lunes)',
  Mes: 'este mes',
  Trimestre: 'este trimestre',
  Semestre: 'este semestre',
  Año: 'este año',
};

export const VentasSection = () => {
  const [period, setPeriod] = useState<PeriodoVentas>('Semana');
  const { data, isPending, isError, error, refetch, isFetching } = useReporteVentas(period);

  const exportar = () => {
    if (!data) return;
    descargarCsv(
      `ventas-${data.period}-${data.desde}.csv`,
      ['Fecha', 'Cliente', 'Cédula', 'Rol', 'Ficha', 'Menú', 'Estado de pago', 'Valor'],
      data.transacciones.map((t) => [fechaHora(t.fecha), t.cliente, t.cedula, t.rol, t.ficha, t.menu, t.estado_pago, t.precio])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-600" />
            Historial de Ventas
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Reservas {DESCRIPCION_PERIODO[period]}, en hora de Colombia
            {isFetching && !isPending ? ' · actualizando…' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="periodo-ventas" className="sr-only">
            Período
          </label>
          <select
            id="periodo-ventas"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodoVentas)}
            className="bg-white border border-gray-300 px-4 py-2 rounded-2xl shadow-xs text-sm font-semibold text-gray-700 cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            {PERIODOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportar}
            disabled={!data || data.transacciones.length === 0}
            className="inline-flex items-center gap-1.5 bg-white border border-gray-300 px-3 py-2 rounded-2xl text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {isError && <ErrorAlert error={error} titulo="No se pudo consultar el reporte de ventas" onReintentar={() => refetch()} />}

      {isPending ? (
        <LoadingSpinner label="Cargando métricas de ventas..." />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-emerald-600 rounded-3xl p-6 text-white shadow-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-emerald-100 uppercase tracking-wider">Almuerzos servidos</p>
                <p className="text-4xl font-black mt-3 tracking-tight">{data.totales.almuerzosServidos}</p>
                <p className="text-xs text-emerald-100 mt-1 font-medium">
                  Incluye {data.totales.almuerzosGratis} gratis de beneficiarios
                </p>
              </div>
              <ShoppingCart className="w-10 h-10 text-white/40 shrink-0" />
            </div>

            <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-blue-100 uppercase tracking-wider">Ingresos cobrados</p>
                <p className="text-4xl font-black mt-3 tracking-tight">{pesos(data.totales.ingresosCobrados)}</p>
                <p className="text-xs text-blue-100 mt-1 font-medium">Solo almuerzos marcados como pagados</p>
              </div>
              <DollarSign className="w-10 h-10 text-white/40 shrink-0" />
            </div>

            <div className="bg-amber-500 rounded-3xl p-6 text-white shadow-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-amber-50 uppercase tracking-wider">Por cobrar</p>
                <p className="text-4xl font-black mt-3 tracking-tight">{pesos(data.totales.porCobrar)}</p>
                <p className="text-xs text-amber-50 mt-1 font-medium">Reservas pendientes de pago</p>
              </div>
              <Clock className="w-10 h-10 text-white/40 shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Distribución de Ventas</h3>
            <p className="text-xs text-gray-500 font-medium mb-6">
              Almuerzos por {data.agrupacion === 'mes' ? 'mes' : 'día'} desde el {data.desde}
            </p>

            {data.totales.almuerzosServidos === 0 ? (
              <p className="py-10 text-center text-gray-400 text-sm">No hay ventas registradas en el período seleccionado.</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                {data.breakdown.map((item) => (
                  <div key={item.fecha} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-gray-700">
                      <span className="capitalize">{item.label}</span>
                      <span className="text-emerald-700">
                        {item.count} almuerzos · {pesos(item.ingresos)} cobrados
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
            <h3 className="text-lg font-extrabold text-gray-900 tracking-tight mb-4">Transacciones del período</h3>

            {data.transacciones.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No hay reservas en este período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Fecha & Hora</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Rol</th>
                      <th className="py-3 px-4">Menú</th>
                      <th className="py-3 px-4">Pago</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {data.transacciones.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/70 transition">
                        <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">{fechaHora(t.fecha)}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">
                          {t.cliente}
                          <span className="block text-xs text-gray-400 font-normal">C.C. {t.cedula}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          <span className="capitalize">{t.rol}</span>
                          {t.ficha && <span className="block text-xs text-gray-400">Ficha {t.ficha}</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{t.menu}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <EstadoPagoBadge estado={t.estado_pago} />
                            {t.beneficiario && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                                <Award className="w-3 h-3" /> Beneficiario
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700">{pesos(t.precio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
