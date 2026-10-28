export const Header = () => {
  return (
    <header className="flex flex-col items-center text-center mb-5 sm:mb-8 space-y-2.5 sm:space-y-3 px-2">
      {/* Logo circular institucional con borde verde y sombra */}
      <div className="w-20 h-20 sm:w-28 sm:h-28 aspect-square rounded-full bg-white border-2 sm:border-4 border-green-500 shadow-2xl flex items-center justify-center p-1.5 sm:p-2 transform hover:scale-105 transition-transform duration-300 shrink-0">
        <img
          src="/logo.png"
          alt="GastroSENA Logo"
          className="w-full h-full object-contain rounded-full"
        />
      </div>

      {/* Título y Subtítulo Responsivos */}
      <div>
        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
          Sistema de Almuerzos
        </h1>
        <p className="text-xs sm:text-base text-emerald-100 font-medium mt-0.5 sm:mt-1 drop-shadow-sm">
          Servicio Nacional de Aprendizaje - GastroSENA
        </p>
      </div>
    </header>
  );
};
