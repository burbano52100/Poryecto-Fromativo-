import { AlertTriangle, RotateCw, X } from 'lucide-react';
import { mensajeDeError } from '../../lib/api';

interface ErrorAlertProps {
  error: unknown;
  titulo?: string;
  onReintentar?: () => void;
  onCerrar?: () => void;
}

/** Aviso de error de la API con el mensaje del backend y, opcionalmente, reintentar. */
export const ErrorAlert = ({ error, titulo = 'No se pudo completar la operación', onReintentar, onCerrar }: ErrorAlertProps) => (
  <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
    <div className="flex-1">
      <p className="font-bold">{titulo}</p>
      <p className="text-red-700">{mensajeDeError(error)}</p>
    </div>
    {onReintentar && (
      <button
        type="button"
        onClick={onReintentar}
        className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-900 cursor-pointer"
      >
        <RotateCw className="w-3.5 h-3.5" /> Reintentar
      </button>
    )}
    {onCerrar && (
      <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="text-red-400 hover:text-red-700 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);
