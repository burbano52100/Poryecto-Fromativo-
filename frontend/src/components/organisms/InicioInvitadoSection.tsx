import { Heart } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';
import { YamboroInfoCard } from '../molecules/YamboroInfoCard';
import { MenuCard } from '../molecules/MenuCard';

export interface InicioInvitadoSectionProps {
  user: User;
  onBuyLunch: () => void;
}

export const InicioInvitadoSection = ({
  user,
  onBuyLunch,
}: InicioInvitadoSectionProps) => {
  const currentDateFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedDateString =
    currentDateFormatted.charAt(0).toUpperCase() + currentDateFormatted.slice(1);

  return (
    <div className="space-y-6">
      {/* Welcome Card for Guest */}
      <div className="bg-gradient-to-r from-teal-800 via-emerald-700 to-teal-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-teal-400/20 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-teal-100 border border-white/20">
            <Heart className="w-3.5 h-3.5 text-rose-300 fill-rose-300" />
            <span>Visitante del Comedor SENA</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            ¡Bienvenido al SENA, {user.name}!
          </h2>

          <p className="text-sm sm:text-base text-teal-100 leading-relaxed font-normal">
            Es un gusto contar con tu visita en nuestro comedor escolar. Puedes adquirir el menú especial para visitantes e invitados particulares.
          </p>
        </div>
      </div>

      {/* Yamboró Info Section */}
      <YamboroInfoCard />

      {/* Menú del Día with Guest Price ($8.000) and "Comprar" Button */}
      <MenuCard
        dateText={formattedDateString}
        title="Menú del Día para Invitados"
        description="Almuerzo completo preparado con insumos frescos de nuestro centro agroecológico: Sopa del día, plato fuerte con proteína, arroz, ensalada, jugo de frutas y postre."
        price="$8.000"
        note="Tarifa de venta directa para particulares e invitados"
        imageUrl="/cafeteria-bg.jpg"
        isAvailable={true}
        onRequestLunch={onBuyLunch}
      />
    </div>
  );
};
