import { Settings, Info } from 'lucide-react';
import { Badge } from '../../atoms/Badge';

/**
 * Reglas con las que el backend calcula el estado de cada material
 * (ESTADO_MATERIAL_SQL en backend/src/services/inventario.service.ts). Solo lectura.
 */
const REGLAS = [
  { estado: 'Venciendo', color: 'red', regla: 'Vence en 5 días o menos (hora de Colombia). Tiene prioridad sobre las demás.' },
  { estado: 'Crítico', color: 'red', regla: 'Stock actual igual o menor al 50 % del stock mínimo.' },
  { estado: 'Bajo', color: 'amber', regla: 'Stock actual igual o menor al stock mínimo.' },
  { estado: 'Bueno', color: 'green', regla: 'Por encima del stock mínimo y sin vencimiento cercano.' },
] as const;

export const ConfiguracionView = () => (
  <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
    <div className="pb-4 border-b border-gray-100">
      <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
        <Settings className="w-6 h-6 text-gray-600" />
        Configuración de Inventario
      </h2>
      <p className="text-sm text-gray-500 font-medium mt-1">Cómo se calcula el estado de cada material en Control de Stock</p>
    </div>

    <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
      {REGLAS.map(({ estado, color, regla }) => (
        <li key={estado} className="flex flex-wrap items-center gap-3 p-4 text-sm text-gray-700">
          <Badge variant={color} className="w-24 justify-center">
            {estado}
          </Badge>
          <span className="flex-1 min-w-[200px]">{regla}</span>
        </li>
      ))}
    </ul>

    <p className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800 font-medium flex gap-2">
      <Info className="w-4 h-4 text-blue-600 shrink-0" />
      El stock mínimo se define por material al crearlo. Las notificaciones automáticas de reposición todavía no están
      implementadas.
    </p>
  </div>
);
