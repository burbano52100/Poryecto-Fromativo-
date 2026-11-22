import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button, Tooltip } from '@heroui/react';
import { asset } from '../../lib/assets';

interface AuthLayoutProps {
  header: ReactNode;
  children: ReactNode;
  onOpenHelp: () => void;
}

export const AuthLayout = ({ header, children, onOpenHelp }: AuthLayoutProps) => (
  <main className="relative flex min-h-screen w-full flex-col items-center justify-between overflow-y-auto bg-neutral-950 px-4 py-6 sm:p-6">
    {/* Fotografía del comedor a pantalla completa, oscurecida para que el formulario se lea bien */}
    <div
      className="fixed inset-0 z-0 bg-cover bg-center"
      style={{ backgroundImage: `url('${asset('/cafeteria-bg.jpg')}')` }}
      aria-hidden="true"
    />
    <div className="fixed inset-0 z-0 bg-neutral-950/70" aria-hidden="true" />

    <div className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center justify-center">
      {header}
      {children}
    </div>

    <footer className="relative z-10 w-full pt-6 text-center">
      <p className="text-xs text-white/70">© 2026 SENA</p>
    </footer>

    {/* El Button de HeroUI es el disparador del Tooltip (sin Tooltip.Trigger, que añadiría otro botón) */}
    <Tooltip delay={300}>
      <Button
        isIconOnly
        size="lg"
        onPress={onOpenHelp}
        aria-label="Abrir centro de ayuda"
        className="fixed right-4 bottom-4 z-40 shadow-lg sm:right-5 sm:bottom-5"
      >
        <HelpCircle />
      </Button>
      <Tooltip.Content placement="left">¿Necesitas ayuda?</Tooltip.Content>
    </Tooltip>
  </main>
);
