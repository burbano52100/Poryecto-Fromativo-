import { asset } from '../../lib/assets';

export const Header = () => {
  return (
    <header className="flex flex-col items-center text-center mb-6 sm:mb-8 gap-3 px-2">
      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white shadow-2xl ring-4 ring-white/30 flex items-center justify-center p-2 shrink-0">
        <img src={asset('/logo.png')} alt="GastroSENA" className="w-full h-full object-contain rounded-full" />
      </div>

      <div>
        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
          Sistema de Almuerzos
        </h1>
        <p className="text-xs sm:text-base text-white/85 font-medium mt-1 drop-shadow-sm">
          SENA Tecnoparque Yamboró · GastroSENA
        </p>
      </div>
    </header>
  );
};
