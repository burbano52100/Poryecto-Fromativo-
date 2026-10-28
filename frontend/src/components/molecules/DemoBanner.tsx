import { Sparkles } from 'lucide-react';

interface DemoBannerProps {
  onFillDemo: () => void;
}

export const DemoBanner = ({ onFillDemo }: DemoBannerProps) => {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="mt-4 pt-3 border-t border-gray-100 text-center">
      <button
        type="button"
        onClick={onFillDemo}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-700 transition cursor-pointer bg-gray-50 hover:bg-green-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-green-300"
        title="Autocompletar formulario en entorno de desarrollo"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Cargar datos de prueba (Modo DEV)</span>
      </button>
    </div>
  );
};
