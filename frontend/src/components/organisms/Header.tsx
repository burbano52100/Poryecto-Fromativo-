import { asset } from '../../lib/assets';

export const Header = () => (
  <header className="mb-6 flex flex-col items-center gap-3 text-center">
    <img src={asset('/sara-icono.svg')} alt="" className="size-20 rounded-full bg-white object-contain p-3 shadow-lg" />
    <div>
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">SARA</h1>
      <p className="mt-1 text-sm text-white/80">Sistema automatizado de solicitud de almuerzos</p>
    </div>
  </header>
);
