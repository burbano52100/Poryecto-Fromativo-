import { Heart } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';
import { YamboroInfoCard } from '../molecules/YamboroInfoCard';
import { ReservaAlmuerzoCard } from './ReservaAlmuerzoCard';

export interface InicioInvitadoSectionProps {
  user: User;
}

export const InicioInvitadoSection = ({ user }: InicioInvitadoSectionProps) => {
  return (
    <div className="space-y-6">
      {/* Welcome Card for Guest */}
      <div className="bg-gradient-to-r from-teal-800 via-emerald-700 to-teal-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-teal-400/20 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-teal-100 border border-white/20">
            <Heart className="w-3.5 h-3.5 text-rose-300 fill-rose-300" />
            <span>Visitante del Comedor SENA</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">¡Bienvenido al SENA, {user.name}!</h2>

          <p className="text-sm sm:text-base text-teal-100 leading-relaxed font-normal">
            Es un gusto contar con tu visita en nuestro comedor escolar. Puedes adquirir el menú especial para visitantes e invitados particulares.
          </p>
        </div>
      </div>

      <YamboroInfoCard />

      {/* Menú del Día con tarifa de invitado y compra real */}
      <ReservaAlmuerzoCard
        user={user}
        ctaLabel="Comprar Almuerzo"
        note="Tarifa de venta directa para particulares e invitados"
        tituloConfirmacion="Comprar Almuerzo de Invitado"
        detalleConfirmacion={(precio) => (
          <>
            <p className="text-center">
              ¿Deseas comprar el <span className="font-bold text-gray-900">Menú del Día</span> a tarifa de visitante por{' '}
              <span className="font-bold text-teal-700">{precio} COP</span>?
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-4 space-y-1 text-xs text-gray-600">
              <p><span className="font-bold">Cliente:</span> {user.name}</p>
              <p><span className="font-bold">Sede:</span> Tecnoparque Yamboró (Pitalito, Huila)</p>
              <p><span className="font-bold">Tarifa:</span> Venta Directa Particular</p>
            </div>
          </>
        )}
        mensajeExito={(reserva) =>
          `Compra registrada por ${reserva.price} COP. Preséntate en la caja del comedor con tu documento para recibir tu bandeja.`
        }
      />
    </div>
  );
};
