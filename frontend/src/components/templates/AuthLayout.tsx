import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { asset } from '../../lib/assets';

interface AuthLayoutProps {
  header: ReactNode;
  children: ReactNode;
  onOpenHelp: () => void;
}

export const AuthLayout = ({ header, children, onOpenHelp }: AuthLayoutProps) => {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between px-4 py-6 sm:p-6 overflow-y-auto font-sans bg-gray-950">
      {/* Fotografía de gastronomía a pantalla completa */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url('${asset('/cafeteria-bg.jpg')}')` }}
        aria-hidden="true"
      />

      {/* Capa oscura semitransparente para que el formulario se lea bien */}
      <div className="fixed inset-0 bg-gray-950/65 z-0" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-md flex-1 flex flex-col items-center justify-center">
        {header}
        {children}
      </div>

      <footer className="relative z-10 w-full text-center pt-6">
        <p className="text-xs sm:text-sm text-white/85 font-medium">© 2026 SENA - Todos los derechos reservados</p>
      </footer>

      <button
        onClick={onOpenHelp}
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 bg-green-600 hover:bg-green-700 active:scale-95 text-white p-3 sm:p-3.5 rounded-full shadow-2xl transition-all duration-200 cursor-pointer flex items-center justify-center border-2 border-white/40 hover:border-white group"
        aria-label="Abrir centro de ayuda"
        title="¿Necesitas ayuda?"
      >
        <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 transform group-hover:rotate-12 transition-transform" />
      </button>
    </main>
  );
};
