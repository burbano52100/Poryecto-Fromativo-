import { X, Phone, Mail, HelpCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../atoms/Button';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal = ({ isOpen, onClose }: HelpModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2 font-bold text-lg">
            <HelpCircle className="w-6 h-6 text-amber-300" />
            <span>Centro de Ayuda - GastroSENA</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-3 text-amber-800 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Demostración Rápida:</p>
              <p>
                Puedes probar el inicio de sesión usando la Cédula{' '}
                <span className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded text-amber-900">
                  1005678901
                </span>{' '}
                y contraseña{' '}
                <span className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded text-amber-900">
                  demo123
                </span>
                .
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" /> ¿Cómo accedo como Aprendiz?
            </h4>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed pl-6">
              Selecciona la pestaña <strong>Aprendiz</strong>, ingresa el número de tu Ficha de formación (ej. 2847251) y tu número de identificación sin puntos ni espacios.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" /> Reconocimiento Facial en Yamboro
            </h4>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed pl-6">
              Si estás registrado en los tótems biométricos de la sede Yamboro, puedes presionar el botón <strong>"Ingresar con Reconocimiento Facial"</strong> para autenticación instantánea.
            </p>
          </div>

          <div className="pt-3 border-t border-gray-200">
            <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-2">Contacto Soporte Técnico</h5>
            <div className="flex flex-col sm:flex-row gap-3 text-xs text-gray-600">
              <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg flex-1 border border-gray-200">
                <Phone className="w-4 h-4 text-green-600 shrink-0" />
                <span>Extensión Yamboro: <strong>5432</strong></span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg flex-1 border border-gray-200">
                <Mail className="w-4 h-4 text-green-600 shrink-0" />
                <span>soporte@gastrosena.edu.co</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
};
