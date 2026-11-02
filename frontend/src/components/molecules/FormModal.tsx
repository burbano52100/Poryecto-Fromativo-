import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface FormModalProps {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: 'md' | 'lg';
}

/** Ventana modal para formularios (Escape o la X la cierran). */
export const FormModal = ({ abierto, titulo, onCerrar, children, ancho = 'md' }: FormModalProps) => {
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`bg-white rounded-3xl p-6 sm:p-8 w-full ${ancho === 'lg' ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 id={tituloId} className="text-xl font-extrabold text-gray-900">
            {titulo}
          </h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
