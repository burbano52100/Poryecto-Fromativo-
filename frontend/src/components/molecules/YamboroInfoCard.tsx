import { MapPin, Compass, Thermometer, ExternalLink, Award, Coffee, TreePine } from 'lucide-react';
import { Button } from '../atoms/Button';

export const YamboroInfoCard = () => {
  const handleOpenMaps = () => {
    window.open(
      'https://www.google.com/maps/search/?api=1&query=Tecnoparque+Agroecologico+Yamboro+Pitalito+Huila',
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-teal-500/30 space-y-6 relative overflow-hidden">
      {/* Background Decorative Icons */}
      <div className="absolute right-[-30px] bottom-[-30px] opacity-10 pointer-events-none">
        <TreePine className="w-80 h-80 text-white" />
      </div>

      <div className="relative z-10 space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 border border-teal-400/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          <TreePine className="w-4 h-4 text-emerald-400" />
          <span>Tecnoparque Agroecológico Yamboró</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
          ¿Qué es Yamboró?
        </h2>

        <p className="text-sm sm:text-base text-teal-100/90 leading-relaxed font-normal">
          El <span className="font-bold text-white">Tecnoparque Agroecológico Yamboró</span> es el principal centro de formación, innovación agroindustrial e investigación del SENA en el sur del Huila. Un espacio sostenible dedicado al desarrollo tecnológico y la gastronomía regional.
        </p>

        {/* Location & Maps Button */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-2xl border border-white/10">
          <div className="space-y-1.5 text-xs sm:text-sm text-teal-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong className="text-white">Ubicación:</strong> Vía Pitalito - San Agustín, Pitalito, Huila</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-teal-200/80">
              <div className="flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-amber-300" />
                <span>20°C Clima templado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-teal-300" />
                <span>1°51'42.1"N 76°02'50.4"W</span>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleOpenMaps}
            icon={<ExternalLink className="w-4 h-4" />}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg text-xs py-2.5 px-4 shrink-0"
          >
            Ver en Google Maps
          </Button>
        </div>
      </div>

      {/* 3 Stats Cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold shrink-0">
            <TreePine className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-black text-white">140 ha</p>
            <p className="text-xs text-teal-200/80 font-medium">Extensión agroecológica</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-black text-white">#1 en Huila</p>
            <p className="text-xs text-teal-200/80 font-medium">Cafés especiales de origen</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-black text-white">Certificación SCA</p>
            <p className="text-xs text-teal-200/80 font-medium">Laboratorio de calidad</p>
          </div>
        </div>
      </div>
    </div>
  );
};
