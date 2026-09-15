import { useState } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, Calendar, ChevronDown } from 'lucide-react';

export const VentasSection = () => {
  const [period, setPeriod] = useState<string>('Semana');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const periods = ['Día', 'Semana', 'Mes', 'Trimestre', 'Semestre', 'Año'];

  const weeklyData = [
    { day: 'Lun', count: 98, total: '$490.000', percent: '78%' },
    { day: 'Mar', count: 112, total: '$560.000', percent: '89%' },
    { day: 'Mié', count: 125, total: '$625.000', percent: '100%' },
    { day: 'Jue', count: 105, total: '$525.000', percent: '84%' },
    { day: 'Vie', count: 118, total: '$590.000', percent: '94%' },
  ];

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
            Analiza las ventas por período
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

      {/* Top 2 Cards: Ventas esta Semana & Ingresos esta Semana */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-emerald-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-emerald-100 uppercase tracking-wider">
              Ventas esta {period}
            </p>
            <p className="text-4xl sm:text-5xl font-black mt-3 tracking-tight">125</p>
            <p className="text-xs text-emerald-100 mt-1 font-medium">almuerzos vendidos</p>
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
            <p className="text-4xl sm:text-5xl font-black mt-3 tracking-tight">$625k</p>
            <p className="text-xs text-blue-100 mt-1 font-medium">COP (Precio único: $5.000)</p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/20">
            <DollarSign className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Registro de Ventas Horizontal Bar Chart */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
              Registro de Ventas
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              Resumen semanal de almuerzos vendidos
            </p>
          </div>
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          {weeklyData.map((item) => (
            <div key={item.day} className="flex items-center gap-4 text-sm font-semibold">
              <span className="w-10 text-gray-500">{item.day}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden relative">
                <div
                  className="bg-emerald-500 h-full rounded-full flex items-center justify-end pr-3 text-white text-xs font-bold transition-all duration-500"
                  style={{ width: item.percent }}
                >
                  {item.count}
                </div>
              </div>
              <span className="w-24 text-right text-gray-900 font-extrabold">{item.total}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen Financiero Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-4">
        <h3 className="text-lg font-extrabold text-gray-900 pb-2 border-b border-gray-100">
          Resumen Financiero
        </h3>

        <div className="divide-y divide-gray-100 text-sm">
          <div className="py-3 flex justify-between items-center">
            <span className="text-gray-500 font-medium">Precio Único Almuerzo</span>
            <span className="font-extrabold text-emerald-600 text-base">$5.000</span>
          </div>

          <div className="py-3 flex justify-between items-center">
            <span className="text-gray-500 font-medium">Ingresos de Hoy</span>
            <span className="font-bold text-gray-900 text-base">$625.000</span>
          </div>

          <div className="py-3 flex justify-between items-center">
            <span className="text-gray-500 font-medium">Ingresos Semana</span>
            <span className="font-bold text-gray-900 text-base">$1.172.500</span>
          </div>

          <div className="py-3 flex justify-between items-center">
            <span className="text-gray-500 font-medium">Total Almuerzos Vendidos</span>
            <span className="font-extrabold text-emerald-700 text-base">558 almuerzos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
