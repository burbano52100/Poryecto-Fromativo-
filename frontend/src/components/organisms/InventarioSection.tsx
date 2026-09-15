import { useState } from 'react';
import {
  Package,
  Search,
  Plus,
  Filter,
  ChefHat,
  History,
  AlertTriangle,
  Settings,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import type { InventarioSubSection } from './Sidebar';

export interface InventarioSectionProps {
  activeSubSection?: InventarioSubSection;
  onSelectSubSection?: (subSection: InventarioSubSection) => void;
}

export const InventarioSection = ({
  activeSubSection = 'stock',
}: InventarioSectionProps) => {
  // 1. Control de Stock State
  const [stockItems, setStockItems] = useState([
    { code: '770123456789', name: 'Arroz Blanco Roa 1kg', category: 'Granos', unit: 'Kg', expiry: '15/12/2026', stock: 45 },
    { code: '770987654321', name: 'Aceite Vegetal Gourmet 1L', category: 'Aceites', unit: 'Litros', expiry: '20/10/2026', stock: 12 },
    { code: '770555444333', name: 'Pechuga de Pollo Fresca', category: 'Carnes', unit: 'Kg', expiry: '18/09/2026', stock: 28 },
    { code: '770222333444', name: 'Papa Pastusa', category: 'Verduras', unit: 'Kg', expiry: '25/09/2026', stock: 60 },
  ]);

  const [stockSearch, setStockSearch] = useState('');
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [newStock, setNewStock] = useState({ code: '', name: '', category: 'Granos', unit: 'Kg', expiry: '', stock: '' });

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStock.name || !newStock.stock) return;
    setStockItems([
      ...stockItems,
      {
        code: newStock.code || String(Math.floor(100000000000 + Math.random() * 900000000000)),
        name: newStock.name,
        category: newStock.category,
        unit: newStock.unit,
        expiry: newStock.expiry || '30/12/2026',
        stock: parseInt(newStock.stock, 10),
      },
    ]);
    setShowAddStockModal(false);
    setNewStock({ code: '', name: '', category: 'Granos', unit: 'Kg', expiry: '', stock: '' });
  };

  // 2. Recetas & Productos State
  const [selectedRecipeIndex, setSelectedRecipeIndex] = useState(0);
  const recipes = [
    {
      code: 'REC-001',
      name: 'Bandeja con Pollo Sudado',
      cost: 3200,
      price: 5000,
      ingredients: [
        { item: 'Pechuga de Pollo', quantity: '0.25 Kg', cost: 1800 },
        { item: 'Arroz Blanco', quantity: '0.15 Kg', cost: 400 },
        { item: 'Papa Pastusa', quantity: '0.20 Kg', cost: 500 },
        { item: 'Aceite Vegetal', quantity: '0.02 Litros', cost: 500 },
      ],
    },
    {
      code: 'REC-002',
      name: 'Carne en Salsa con Ensalada',
      cost: 3500,
      price: 5000,
      ingredients: [
        { item: 'Carne de Res', quantity: '0.20 Kg', cost: 2200 },
        { item: 'Arroz Blanco', quantity: '0.15 Kg', cost: 400 },
        { item: 'Tomate y Cebolla', quantity: '0.10 Kg', cost: 500 },
        { item: 'Aceite', quantity: '0.02 Litros', cost: 400 },
      ],
    },
  ];

  // 3. Merma Form State
  const [mermaMaterial, setMermaMaterial] = useState('Pechuga de Pollo Fresca');
  const [mermaQuantity, setMermaQuantity] = useState('');
  const [mermaReason, setMermaReason] = useState('');
  const [mermasHistory, setMermasHistory] = useState([
    { date: '14/09/2026 10:30 AM', material: 'Tomate Chonto', quantity: '2.5 Kg', reason: 'Deterioro por maduración extrema' },
    { date: '12/09/2026 04:15 PM', material: 'Leche Entera', quantity: '3 Litros', reason: 'Vencimiento de fecha de empaque' },
  ]);
  const [mermaSuccess, setMermaSuccess] = useState(false);

  const handleRegisterMerma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mermaQuantity || !mermaReason) return;
    const now = new Date().toLocaleString('es-CO');
    setMermasHistory([
      { date: now, material: mermaMaterial, quantity: `${mermaQuantity} Kg`, reason: mermaReason },
      ...mermasHistory,
    ]);
    setMermaSuccess(true);
    setMermaQuantity('');
    setMermaReason('');
    setTimeout(() => setMermaSuccess(false), 3500);
  };

  return (
    <div className="space-y-6">
      {/* 1. CONTROL DE STOCK */}
      {activeSubSection === 'stock' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Package className="w-6 h-6 text-green-600" />
                Control de Stock e Inventario
              </h2>
              <p className="text-sm text-gray-500 font-medium mt-1">
                Monitoreo de materias primas e insumos del comedor escolar
              </p>
            </div>

            <Button
              variant="primary"
              onClick={() => setShowAddStockModal(true)}
              icon={<Plus className="w-4 h-4" />}
              className="bg-green-600 hover:bg-green-700 shadow-green-600/30 font-bold"
            >
              Agregar Material
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Buscar artículo o código..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition"
              />
            </div>

            <Button variant="outline" icon={<Filter className="w-4 h-4" />}>
              Filtros
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Código de Barras</th>
                  <th className="py-3 px-4">Nombre del Artículo</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Unidad</th>
                  <th className="py-3 px-4">Vencimiento</th>
                  <th className="py-3 px-4 text-right">Stock Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-medium">
                {stockItems
                  .filter((item) => item.name.toLowerCase().includes(stockSearch.toLowerCase()) || item.code.includes(stockSearch))
                  .map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{item.code}</td>
                      <td className="py-3.5 px-4 font-bold text-gray-900">{item.name}</td>
                      <td className="py-3.5 px-4 text-gray-600">{item.category}</td>
                      <td className="py-3.5 px-4 text-gray-600">{item.unit}</td>
                      <td className="py-3.5 px-4 text-gray-500 text-xs">{item.expiry}</td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-700">{item.stock}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. RECETAS & PRODUCTOS */}
      {activeSubSection === 'recetas' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-6">
          <div className="pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-green-600" />
              Recetas & Productos del Menú
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Escandallo de recetas, costos de producción y fórmula de ingredientes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Menu Items List */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                Platos del Menú
              </h3>
              {recipes.map((rec, idx) => (
                <button
                  key={rec.code}
                  onClick={() => setSelectedRecipeIndex(idx)}
                  className={`w-full text-left p-4 rounded-2xl border transition duration-200 cursor-pointer ${
                    selectedRecipeIndex === idx
                      ? 'bg-emerald-50/90 border-emerald-300 shadow-sm'
                      : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xs font-mono text-emerald-700 font-bold">{rec.code}</span>
                  <h4 className="text-base font-bold text-gray-900 mt-0.5">{rec.name}</h4>
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    Costo: ${rec.cost.toLocaleString('es-CO')} | Precio: ${rec.price.toLocaleString('es-CO')}
                  </p>
                </button>
              ))}
            </div>

            {/* Right Column: Selected Recipe Details & Formula */}
            <div className="md:col-span-2 space-y-5 bg-gray-50/70 p-6 rounded-3xl border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-600">
                    {recipes[selectedRecipeIndex].code}
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900">
                    {recipes[selectedRecipeIndex].name}
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-sm font-bold">
                  <div>
                    <span className="text-xs text-gray-400 block font-normal">Costo Producción</span>
                    <span className="text-gray-900">${recipes[selectedRecipeIndex].cost.toLocaleString('es-CO')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-normal">Precio Venta</span>
                    <span className="text-emerald-600">${recipes[selectedRecipeIndex].price.toLocaleString('es-CO')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-normal">Margen</span>
                    <span className="text-blue-600">36%</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-800">Fórmula de la Receta</h4>
                  <Button variant="emerald" className="text-xs py-1.5 px-3 font-bold" icon={<Plus className="w-3.5 h-3.5" />}>
                    Agregar Ingrediente
                  </Button>
                </div>

                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-bold text-gray-400 border-b border-gray-200 pb-2">
                      <th className="py-2">Ingrediente / Material</th>
                      <th className="py-2">Cantidad por Porción</th>
                      <th className="py-2 text-right">Costo Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/60 font-medium">
                    {recipes[selectedRecipeIndex].ingredients.map((ing, i) => (
                      <tr key={i}>
                        <td className="py-2.5 font-semibold text-gray-800">{ing.item}</td>
                        <td className="py-2.5 text-gray-600">{ing.quantity}</td>
                        <td className="py-2.5 text-right font-bold text-gray-900">${ing.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. KARDEX (HISTORIAL) */}
      {activeSubSection === 'kardex' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
          <div className="pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <History className="w-6 h-6 text-green-600" />
              Kardex de Movimientos
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Registro histórico de entradas, salidas y ajustes de inventario
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-sm">
            <input type="date" className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium" />
            <select className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium">
              <option>Todos los Materiales</option>
              <option>Arroz Blanco</option>
              <option>Pechuga de Pollo</option>
            </select>
            <select className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium">
              <option>Todos los Movimientos</option>
              <option>Entrada (Compra)</option>
              <option>Salida (Preparación)</option>
              <option>Merma (Baja)</option>
            </select>
            <Button variant="primary" className="text-xs py-2 px-4 font-bold bg-green-600">
              Aplicar Filtros
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha & Hora</th>
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4 text-emerald-700">Entrada</th>
                  <th className="py-3 px-4 text-red-600">Salida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                <tr>
                  <td className="py-3.5 px-4 text-xs text-gray-500">14/09/2026 08:30 AM</td>
                  <td className="py-3.5 px-4 font-bold text-gray-900">Arroz Blanco Roa 1kg</td>
                  <td className="py-3.5 px-4 text-gray-600">Carlos Encargado</td>
                  <td className="py-3.5 px-4 text-gray-600">Recepción Proveedor</td>
                  <td className="py-3.5 px-4 font-extrabold text-emerald-700">+50 Kg</td>
                  <td className="py-3.5 px-4 text-gray-400">-</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 text-xs text-gray-500">14/09/2026 11:00 AM</td>
                  <td className="py-3.5 px-4 font-bold text-gray-900">Pechuga de Pollo Fresca</td>
                  <td className="py-3.5 px-4 text-gray-600">Chef Comedor</td>
                  <td className="py-3.5 px-4 text-gray-600">Preparación Almuerzos</td>
                  <td className="py-3.5 px-4 text-gray-400">-</td>
                  <td className="py-3.5 px-4 font-extrabold text-red-600">-15 Kg</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. GESTIÓN DE MERMAS */}
      {activeSubSection === 'mermas' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-6">
          <div className="pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Gestión de Mermas y Pérdidas
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Registro de desperdicios, alimentos vencidos o deterioro
            </p>
          </div>

          {mermaSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Merma registrada correctamente. Se actualizó el Kardex con la salida del stock.</span>
            </div>
          )}

          <form onSubmit={handleRegisterMerma} className="bg-amber-50/50 p-6 rounded-3xl border border-amber-200 space-y-4">
            <h3 className="text-base font-extrabold text-amber-950">Registrar Nueva Merma</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Material Afectado</label>
                <select
                  value={mermaMaterial}
                  onChange={(e) => setMermaMaterial(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-sm font-medium focus:outline-none"
                >
                  <option>Pechuga de Pollo Fresca</option>
                  <option>Papa Pastusa</option>
                  <option>Tomate Chonto</option>
                  <option>Leche Entera</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Cantidad Perdida (Kg / L)</label>
                <input
                  type="number"
                  placeholder="Ej: 2.5"
                  value={mermaQuantity}
                  onChange={(e) => setMermaQuantity(e.target.value)}
                  required
                  className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-sm font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Razón Detallada</label>
                <input
                  type="text"
                  placeholder="Ej: Vencimiento / Daño por empaque"
                  value={mermaReason}
                  onChange={(e) => setMermaReason(e.target.value)}
                  required
                  className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setMermaQuantity(''); setMermaReason(''); }}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                Registrar Merma
              </Button>
            </div>
          </form>

          {/* Historial de Mermas */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700">Mermas Registradas Recientemente</h3>
            <div className="space-y-2">
              {mermasHistory.map((m, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex justify-between items-center text-sm">
                  <div>
                    <span className="text-xs text-gray-400 font-mono">{m.date}</span>
                    <h4 className="font-bold text-gray-900">{m.material}</h4>
                    <p className="text-xs text-gray-600 mt-0.5">{m.reason}</p>
                  </div>
                  <span className="font-extrabold text-red-600 text-base">{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. CONFIGURACIÓN */}
      {activeSubSection === 'configuracion' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-4">
          <div className="pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Settings className="w-6 h-6 text-gray-600" />
              Configuración de Inventario
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Parámetros de stock mínimo y alertas automáticas de reposición
            </p>
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-3 text-sm text-gray-700">
            <p className="font-bold text-gray-900">Configuraciones generales de alertas:</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded" />
              <span>Notificar cuando el stock de un material esté por debajo del 20%</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded" />
              <span>Notificar 5 días antes del vencimiento de insumos perecederos</span>
            </label>
          </div>
        </div>
      )}

      {/* Modal Agregar Stock */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <form onSubmit={handleAddStock} className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <h3 className="text-xl font-extrabold text-gray-900">Agregar Nuevo Material al Stock</h3>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nombre del Material</label>
              <input
                type="text"
                placeholder="Ej: Harina de Trigo 1kg"
                value={newStock.name}
                onChange={(e) => setNewStock({ ...newStock, name: e.target.value })}
                required
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-sm font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Categoría</label>
                <select
                  value={newStock.category}
                  onChange={(e) => setNewStock({ ...newStock, category: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-sm font-medium"
                >
                  <option>Granos</option>
                  <option>Carnes</option>
                  <option>Verduras</option>
                  <option>Lácteos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Stock Inicial</label>
                <input
                  type="number"
                  placeholder="50"
                  value={newStock.stock}
                  onChange={(e) => setNewStock({ ...newStock, stock: e.target.value })}
                  required
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-sm font-medium"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowAddStockModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" className="bg-green-600 font-bold">
                Guardar Material
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
