import { Calendar, Utensils, CheckCircle2 } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';

export interface MenuCardProps {
  dateText?: string;
  title?: string;
  description?: string;
  price?: string;
  note?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  onRequestLunch: () => void;
  isLoading?: boolean;
}

export const MenuCard = ({
  dateText = 'Hoy',
  title = 'Menú del Día',
  description = 'Almuerzo completo: Sopa, bandeja con proteína, arroz, ensalada, jugo natural y postre',
  price = '$5.000',
  note,
  imageUrl = '/cafeteria-bg.jpg',
  isAvailable = true,
  onRequestLunch,
  isLoading = false,
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

        {isAvailable ? (
          <Badge variant="green">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Disponible
          </Badge>
        ) : (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
            Agotado
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6 flex flex-col md:flex-row gap-6 items-center">
        <div className="relative w-full md:w-56 h-44 rounded-2xl overflow-hidden shadow-sm shrink-0 border border-gray-100 bg-gray-100">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition hover:scale-105 duration-300"
            onError={(e) => {
              // Fallback image if local photo fails to load
              (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
            }}
          />
          <div className="absolute top-2 right-2">
            <span className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-1 rounded-full shadow-md">
              SENA
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-between w-full h-full">
          <div>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed font-normal">
              {description}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase font-semibold tracking-wider text-gray-400">Valor Almuerzo</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">{price}</p>
              {note && (
                <p className="text-xs text-gray-400 font-medium mt-0.5">{note}</p>
              )}
            </div>

            <Button
              variant="primary"
              onClick={onRequestLunch}
              disabled={!isAvailable || isLoading}
              isLoading={isLoading}
              className="px-6 py-3 text-base shadow-emerald-600/30 font-bold"
            >
              Solicitar Almuerzo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
