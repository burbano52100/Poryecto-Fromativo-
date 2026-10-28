import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ShoppingCart, DollarSign, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../lib/api';

interface VentasReportResponse {
  period: string;
  totalVentas: number;
  totalIngresos: number;
  breakdown: { day: string; count: number; total: string; percent: string }[];
  transacciones: {
    id: string;
    fecha: string;
    cliente: string;
    cedula: string;
    rol: string;
    menu: string;
    precio: number;
    metodo_pago: string;
  }[];
}

export const VentasSection = () => {
  const [period, setPeriod] = useState<string>('Semana');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const periods = ['Día', 'Semana', 'Mes', 'Trimestre', 'Semestre', 'Año'];

  const { data, isLoading, isError, error } = useQuery<VentasReportResponse>({
    queryKey: ['ventas', period],
    queryFn: async () => (await apiClient.get<VentasReportResponse>(`/ventas?period=${encodeURIComponent(period)}`)).data,
  });

  const totalVentas = data?.totalVentas ?? 0;
  const totalIngresos = data?.totalIngresos ?? 0;
  const breakdown = data?.breakdown || [];
  const transacciones = data?.transacciones || [];

  return (
    <div className="space-y-6">
      {/* Header and Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-600" />
            Historial de Ventas
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Analiza las ventas en tiempo real desde la base de datos
          </p>
        </div>

        {/* Custom Period Select Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-2xl shadow-xs text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            <span>{period}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 overflow-hidden py-1">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm font-medium transition cursor-pointer ${
                    period === p
                      ? 'bg-emerald-50 text-emerald-700 font-bold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <span>Error al consultar el reporte de ventas: {error instanceof Error ? error.message : 'Error desconocido'}</span>
        </div>
      )}

      {/* Top 2 Cards: Ventas & Ingresos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-emerald-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-emerald-100 uppercase tracking-wider">
              Ventas esta {period}
            </p>
            <p className="text-4xl sm:text-5xl font-black mt-3 tracking-tight">
              {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : totalVentas}
            </p>
            <p className="text-xs text-emerald-100 mt-1 font-medium">almuerzos registrados en la base de datos</p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/20">
            <ShoppingCart className="w-8 h-8" />
          </div>
        </div>

        <div className="bg-blue-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-blue-100 uppercase tracking-wider">
              Ingresos esta {period}
            </p>
            <p className="text-4xl sm:text-5xl font-black mt-3 tracking-tight">
              {isLoading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                `$${totalIngresos.toLocaleString('es-CO')}`
              )}
            </p>
            <p className="text-xs text-blue-100 mt-1 font-medium">COP cobrados y facturados</p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/20">
            <DollarSign className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Gráfico y desglose */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
              Registro y Distribución de Ventas
            </h3>
            <p className="text-xs text-gray-500 font-medium">Volumen por días en el período seleccionado</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center items-center text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando métricas de ventas...</span>
          </div>
        ) : breakdown.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No hay registros de ventas para el período seleccionado.
          </div>
        ) : (
          <div className="space-y-4">
            {breakdown.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-gray-700">
                  <span>{item.day}</span>
                  <span className="text-emerald-700">{item.count} almuerzos ({item.total})</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: item.percent }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabla de Transacciones Recientes */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
        <h3 className="text-lg font-extrabold text-gray-900 tracking-tight mb-4">
          Transacciones Recientes
        </h3>

        {transacciones.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No hay ventas registradas recientemente.</p>
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
                {transacciones.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {new Date(t.fecha).toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900">{t.cliente}</td>
                    <td className="py-3 px-4 text-gray-600 capitalize">{t.rol}</td>
                    <td className="py-3 px-4 text-gray-600">{t.menu}</td>
                    <td className="py-3 px-4 text-xs font-semibold capitalize text-gray-500">
                      {t.metodo_pago}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                      ${t.precio.toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
