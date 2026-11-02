import { X, Phone, Mail, HelpCircle, CheckCircle, Info } from 'lucide-react';
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex gap-3 text-emerald-900 text-xs sm:text-sm">
            <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Acceso Institucional SENA:</p>
              <p>
                Ingresa con tu documento de identidad y tu contraseña. El sistema reconoce tu tipo de cuenta y te lleva directo a tu panel.
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" /> ¿Cómo ingreso?
            </h4>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed pl-6">
              Escribe tu número de documento sin puntos ni espacios y tu contraseña. No necesitas elegir si eres aprendiz, instructor, encargado o invitado.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" /> ¿Aún no tienes cuenta?
            </h4>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed pl-6">
              Presiona <strong>"Registrarse"</strong> debajo del formulario. Los aprendices se registran con su número de Ficha; los visitantes, como Invitado.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" /> ¿Olvidaste tus credenciales?
            </h4>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed pl-6">
              Comunícate con la coordinación académica o acércate a la oficina de bienestar al aprendiz para restablecer tus datos de acceso.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <h4 className="font-bold text-gray-900 text-sm mb-2">Canales de Soporte</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <Phone className="w-4 h-4 text-green-600 shrink-0" />
                <span>Ext. 1234 - Cafetería</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <Mail className="w-4 h-4 text-green-600 shrink-0" />
                <span>gastrosena@sena.edu.co</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 text-right">
          <Button variant="secondary" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
};
