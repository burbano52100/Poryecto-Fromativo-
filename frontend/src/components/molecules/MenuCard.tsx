import { Calendar, Utensils, CheckCircle2, Award, Zap, Info } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { EstadoPagoBadge } from '../atoms/EstadoPagoBadge';
import { resolverImagen } from '../../lib/assets';
import type { EstadoPago } from '../../types/api';

export interface MenuCardProps {
  dateText: string;
  title: string;
  description?: string | null;
  price: string;
  note?: string;
  imageUrl?: string | null;
  /** Hay cupo en el menú. */
  isAvailable: boolean;
  /** El usuario puede reservar ahora; si no, se muestra el motivo. */
  canReserve: boolean;
  unavailableReason?: string | null;
  /** Estado de la reserva del usuario para este menú, si ya reservó. */
  reservation?: { estado_pago: EstadoPago } | null;
  ctaLabel?: string;
  onRequestLunch: () => void;
  isLoading?: boolean;
  isBeneficiario?: boolean;
}

export const MenuCard = ({
  dateText,
  title,
  description,
  price,
  note,
  imageUrl,
  isAvailable,
  canReserve,
  unavailableReason,
  reservation,
  ctaLabel = 'Solicitar Almuerzo',
  onRequestLunch,
  isLoading = false,
  isBeneficiario = false,
}: MenuCardProps) => {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200/80 overflow-hidden hover:shadow-md transition duration-200">
      <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Utensils className="w-6 h-6 text-green-600" />
            {title}
          </h2>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 mt-1 font-medium">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{dateText}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isBeneficiario && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              Beneficiario SENA
            </span>
          )}

          {isAvailable ? (
            <Badge variant="green">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Disponible
            </Badge>
          ) : (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">Agotado</span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 flex flex-col md:flex-row gap-6 items-center">
        <div className="relative w-full md:w-56 h-44 rounded-2xl overflow-hidden shadow-sm shrink-0 border border-gray-100 bg-gray-100">
          <img
            src={resolverImagen(imageUrl)}
            alt={title}
            className="w-full h-full object-cover transition hover:scale-105 duration-300"
            onError={(e) => {
              e.currentTarget.src = resolverImagen(null);
            }}
          />
          <div className="absolute top-2 right-2">
            <span className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-1 rounded-full shadow-md">GastroSENA</span>
          </div>
          {isBeneficiario && (
            <div className="absolute bottom-2 left-2">
              <span className="bg-amber-500 text-white font-black text-[11px] px-2 py-0.5 rounded-md shadow-md flex items-center gap-1">
                <Award className="w-3 h-3" /> $0 Almuerzo
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between w-full h-full">
          {description && <p className="text-sm sm:text-base text-gray-600 leading-relaxed font-normal">{description}</p>}

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase font-semibold tracking-wider text-gray-400">Valor Almuerzo</p>
              <div className="flex items-baseline gap-2">
                <p
                  className={`text-2xl sm:text-3xl font-black tracking-tight ${
                    isBeneficiario ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {price}
                </p>
                {isBeneficiario ? (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    Subsidio 100%
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 font-medium">COP</span>
                )}
              </div>
              {note && <p className="text-xs text-gray-400 font-medium mt-0.5">{note}</p>}
            </div>

            {reservation ? (
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" /> Almuerzo reservado
                </span>
                <EstadoPagoBadge estado={reservation.estado_pago} />
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={onRequestLunch}
                disabled={!canReserve || isLoading}
                isLoading={isLoading}
                className={`px-6 py-3 text-base font-black flex items-center gap-2 shadow-md ${
                  isBeneficiario ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30' : 'shadow-emerald-600/30'
                }`}
              >
                {isBeneficiario ? (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Reservar Almuerzo (Gratis)</span>
                  </>
                ) : (
                  <span>{ctaLabel}</span>
                )}
              </Button>
            )}
          </div>

          {!reservation && !canReserve && unavailableReason && (
            <p className="mt-3 text-xs font-semibold text-gray-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {unavailableReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
