import { Users, BookOpen, UserCheck, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';

export interface GrupoItem {
  id: string;
  ficha: string;
  program: string;
  studentsCount: number;
  vocero: string;
  shift: string;
}

export const GruposSection = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const grupos: GrupoItem[] = [
    { id: '1', ficha: '2847251', program: 'Análisis y Desarrollo de Software (ADSO)', studentsCount: 32, vocero: 'Carlos Ruiz', shift: 'Mañana' },
    { id: '2', ficha: '2847252', program: 'Gestión Logística Integral', studentsCount: 28, vocero: 'Laura Benavides', shift: 'Mañana' },
    { id: '3', ficha: '2847253', program: 'Mantenimiento Electrónico e Industrial', studentsCount: 30, vocero: 'Andrés Felipe Castro', shift: 'Tarde' },
    { id: '4', ficha: '2847254', program: 'Contabilidad y Finanzas Comercial', studentsCount: 25, vocero: 'Valentina Morales', shift: 'Mañana' },
    { id: '5', ficha: '2847255', program: 'Gestión del Talento Humano', studentsCount: 35, vocero: 'Diego Alexander Parra', shift: 'Tarde' },
  ];

  const filteredGrupos = grupos.filter(
    (g) =>
      g.ficha.includes(searchTerm) ||
      g.program.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.vocero.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Search Bar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-green-600" />
              Gestión de Grupos y Fichas SENA
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Listado de programas de formación y aprendices asignados al comedor
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar por ficha o programa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Top 3 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Grupos</p>
              <p className="text-2xl font-black text-emerald-950 mt-0.5">5 Fichas</p>
            </div>
          </div>

          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Total Estudiantes</p>
              <p className="text-2xl font-black text-blue-950 mt-0.5">150 Aprendices</p>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Promedio Consumo</p>
              <p className="text-2xl font-black text-amber-950 mt-0.5">88% Asistencia</p>
            </div>
          </div>
        </div>

        {/* List of Group Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {filteredGrupos.map((grupo) => (
            <div
              key={grupo.id}
              className="p-5 rounded-2xl bg-gray-50/80 border border-gray-200/80 hover:border-emerald-300 hover:shadow-md transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                    Ficha {grupo.ficha}
                  </span>
                  <span className="text-xs font-semibold text-gray-400">Jornada {grupo.shift}</span>
                </div>

                <h3 className="text-base font-extrabold text-gray-900 mt-2.5 leading-snug">
                  {grupo.program}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-600">
                <div>
                  <p><span className="font-bold text-gray-800">Aprendices:</span> {grupo.studentsCount} inscritos</p>
                  <p className="mt-0.5"><span className="font-bold text-gray-800">Vocero:</span> {grupo.vocero}</p>
                </div>

                <button className="p-2 rounded-xl bg-white border border-gray-200 text-emerald-700 hover:bg-emerald-50 transition cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
