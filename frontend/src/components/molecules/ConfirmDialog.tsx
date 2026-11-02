import { useEffect, useId, type ReactNode } from 'react';
import { Button } from '../atoms/Button';

type Variante = 'emerald' | 'red' | 'amber';

interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  icono?: ReactNode;
  children: ReactNode;
  textoConfirmar: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  cargando?: boolean;
  variante?: Variante;
}

const ESTILOS: Record<Variante, { icono: string; boton: string }> = {
  emerald: {
    icono: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    boton: 'bg-green-600 hover:bg-green-700 shadow-green-600/30',
  },
  red: {
    icono: 'bg-red-100 text-red-600 border-red-200',
    boton: 'bg-red-600 hover:bg-red-700 shadow-red-600/30',
  },
  amber: {
    icono: 'bg-amber-100 text-amber-600 border-amber-200',
    boton: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30',
  },
};

/** Modal de confirmación accesible (Escape cierra, foco en el diálogo). */
export const ConfirmDialog = ({
  abierto,
  titulo,
  icono,
  children,
  textoConfirmar,
  onConfirmar,
  onCancelar,
  cargando = false,
  variante = 'emerald',
}: ConfirmDialogProps) => {
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cargando) onCancelar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [abierto, cargando, onCancelar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900"
      >
        {icono && (
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border mx-auto ${ESTILOS[variante].icono}`}
          >
            {icono}
          </div>
        )}
        <h3 id={tituloId} className="text-xl font-extrabold text-center text-gray-900">
          {titulo}
        </h3>
        <div className="text-sm text-gray-600 mt-2 leading-relaxed">{children}</div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" fullWidth onClick={onCancelar} disabled={cargando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={onConfirmar}
            isLoading={cargando}
            className={`font-bold ${ESTILOS[variante].boton}`}
          >
            {textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
};
