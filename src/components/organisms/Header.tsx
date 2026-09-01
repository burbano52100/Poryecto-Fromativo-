export const Header = () => {
  return (
    <header className="flex flex-col items-center text-center mb-6 sm:mb-8 space-y-3">
      {/* Logo circular blanco con borde verde */}
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white border-4 border-green-500 shadow-2xl flex items-center justify-center p-2 transform hover:scale-105 transition-transform duration-300">
        <img
          src="/logo.png"
          alt="GastroSENA Logo"
          className="w-full h-full object-contain rounded-full"
        />
      </div>

      {/* Título y Subtítulo */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
          Sistema de Almuerzos
        </h1>
        <p className="text-base sm:text-lg text-emerald-100 font-medium mt-1 drop-shadow-sm">
          Servicio Nacional de Aprendizaje
        </p>
      </div>
    </header>
  );
};
