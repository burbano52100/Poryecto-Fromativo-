import { Sparkles } from 'lucide-react';

interface DemoBannerProps {
  onFillDemo: () => void;
}

export const DemoBanner = ({ onFillDemo }: DemoBannerProps) => {
  return (
    <div className="mt-4 pt-3 border-t border-gray-100 text-center">
      <button
        type="button"
        onClick={onFillDemo}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-700 transition cursor-pointer bg-gray-50 hover:bg-green-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-green-300"
        title="Haz clic para autocompletar la demostración"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>
          Demo: Use cédula <strong className="text-gray-700">"1005678901"</strong> y contraseña <strong className="text-gray-700">"demo123"</strong>
        </span>
      </button>
    </div>
  );
};
