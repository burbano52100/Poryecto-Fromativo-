import { useState } from 'react';
import { History } from 'lucide-react';
import { Badge } from '../../atoms/Badge';
import { LoadingSpinner } from '../../atoms/LoadingSpinner';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { useKardex, useMateriales } from '../../../hooks/useInventario';
import type { FiltrosKardex, TipoKardex } from '../../../types/api';

const COLOR_TIPO: Record<TipoKardex, 'green' | 'amber' | 'red' | 'blue'> = {
  entrada: 'green',
  salida: 'amber',
  merma: 'red',
  ajuste: 'blue',
};

const CAMPO = 'bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium';

export const KardexView = () => {
  const [filtros, setFiltros] = useState<FiltrosKardex>({});
  const { data: materiales = [] } = useMateriales();
  const { data, isPending, isError, error, refetch } = useKardex(filtros);

  // Un campo vacío quita el filtro (no se envía al backend)
  const cambiar = <K extends keyof FiltrosKardex>(campo: K, valor: string) =>
    setFiltros((prev) => {
      const siguiente = { ...prev };
      if (valor === '') delete siguiente[campo];
      else siguiente[campo] = valor as FiltrosKardex[K];
      return siguiente;
    });

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
      <div className="pb-4 border-b border-gray-100">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-green-600" />
          Kardex de Movimientos
        </h2>
        <p className="text-sm text-gray-500 font-medium mt-1">Registro histórico de entradas, salidas y mermas de inventario</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-sm">
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Desde
          <input type="date" value={filtros.desde ?? ''} onChange={(e) => cambiar('desde', e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Hasta
          <input type="date" value={filtros.hasta ?? ''} onChange={(e) => cambiar('hasta', e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Material
          <select value={filtros.material_id ?? ''} onChange={(e) => cambiar('material_id', e.target.value)} className={CAMPO}>
            <option value="">Todos los materiales</option>
            {materiales.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Movimiento
          <select value={filtros.tipo ?? ''} onChange={(e) => cambiar('tipo', e.target.value)} className={CAMPO}>
            <option value="">Todos los movimientos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="merma">Merma</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </label>
        {Object.keys(filtros).length > 0 && (
          <button type="button" onClick={() => setFiltros({})} className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer pb-2">
            Limpiar filtros
          </button>
        )}
      </div>

      {isPending ? (
        <LoadingSpinner label="Cargando movimientos..." />
      ) : isError ? (
        <ErrorAlert error={error} titulo="No se pudo cargar el Kardex" onReintentar={() => refetch()} />
      ) : (
        <>
          <p className="text-xs text-gray-500 font-medium">
            {data.total} movimiento{data.total === 1 ? '' : 's'}
            {data.total > data.items.length ? ` (se muestran los ${data.items.length} más recientes)` : ''}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha & Hora</th>
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4 text-emerald-700">Entrada</th>
                  <th className="py-3 px-4 text-red-600">Salida</th>
                  <th className="py-3 px-4 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No hay movimientos con estos filtros.
                    </td>
                  </tr>
                ) : (
                  data.items.map((mov) => (
                    <tr key={mov.id}>
                      <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">{mov.date}</td>
                      <td className="py-3.5 px-4 font-bold text-gray-900">{mov.material}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant={COLOR_TIPO[mov.tipo]} className="capitalize">
                          {mov.tipo}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">{mov.concepto}</td>
                      <td className="py-3.5 px-4 text-gray-600">{mov.responsible}</td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-700 whitespace-nowrap">{mov.entry}</td>
                      <td className="py-3.5 px-4 font-extrabold text-red-600 whitespace-nowrap">{mov.exit}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                        {mov.saldo} {mov.unidad}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
