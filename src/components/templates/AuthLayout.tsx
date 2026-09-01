import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface AuthLayoutProps {
  header: ReactNode;
  children: ReactNode;
  onOpenHelp: () => void;
}

export const AuthLayout = ({ header, children, onOpenHelp }: AuthLayoutProps) => {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto select-none font-sans">
      {/* 1. Imagen de Fondo de Comedor / Cafetería */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url('/cafeteria-bg.jpg')` }}
        aria-hidden="true"
      />

      {/* 2. Overlay degradado diagonal de verde (arriba-izquierda) a naranja/ámbar (abajo-derecha) */}
      <div
        className="fixed inset-0 bg-gradient-to-br from-green-900/85 via-emerald-800/80 to-amber-700/80 z-0"
        aria-hidden="true"
      />

      {/* Wrapper de Contenido Centrado */}
      <div className="relative z-10 w-full max-w-4xl flex-1 flex flex-col items-center justify-center py-6">
        {header}
        {children}
      </div>

      {/* PIE DE PÁGINA */}
      <footer className="relative z-10 w-full text-center py-4">
        <p className="text-xs sm:text-sm text-white/90 font-medium drop-shadow-xs">
          © 2026 SENA - Todos los derechos reservados
        </p>
      </footer>

      {/* Botón Circular Flotante de Ayuda */}
      <button
        onClick={onOpenHelp}
        className="fixed bottom-5 right-5 z-40 bg-green-600 hover:bg-green-700 active:scale-95 text-white p-3.5 rounded-full shadow-2xl transition-all duration-200 cursor-pointer flex items-center justify-center border-2 border-white/40 hover:border-white group"
        aria-label="Abrir centro de ayuda"
        title="¿Necesitas ayuda?"
      >
        <HelpCircle className="w-6 h-6 transform group-hover:rotate-12 transition-transform" />
      </button>
    </main>
  );
};
