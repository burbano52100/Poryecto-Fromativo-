import { useState } from 'react';
import { Mail, CheckCircle2, Clock, MessageSquare, User, Calendar } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';

export interface SugerenciaItem {
  id: string;
  subject: string;
  message: string;
  author: string;
  role: string;
  fichaOrDoc: string;
  date: string;
  status: 'PENDIENTE' | 'ATENDIDA';
}

export const BuzonSugerenciasEncargadoSection = () => {
  const [sugerencias, setSugerencias] = useState<SugerenciaItem[]>([
    {
      id: '1',
      subject: 'Variedad de opciones de frutas en el almuerzo',
      message: 'Me gustaría sugerir que en el jugo natural o postre haya más opciones con frutas de temporada como mango o papaya.',
      author: 'Carlos Ruiz',
      role: 'Aprendiz',
      fichaOrDoc: 'Ficha 2847251',
      date: '14 Sep 2026',
      status: 'PENDIENTE',
    },
    {
      id: '2',
      subject: 'Horario de entrega de tickets para Instructores',
      message: 'Sugerimos agilizar la atención en caja entre las 12:00 PM y 12:30 PM ya que la fila de docentes se cruza con la de estudiantes.',
      author: 'María Fernanda Gómez',
      role: 'Instructor',
      fichaOrDoc: 'C.C. 1098765432',
      date: '13 Sep 2026',
      status: 'PENDIENTE',
    },
    {
      id: '3',
      subject: 'Excelente sazón en la sopa del martes',
      message: 'Felicitaciones al equipo de cocina por la sopa de verduras del martes pasado, estuvo deliciosa.',
      author: 'Laura Benavides',
      role: 'Aprendiz',
      fichaOrDoc: 'Ficha 2847252',
      date: '10 Sep 2026',
      status: 'ATENDIDA',
    },
  ]);

  const [attendedSuccess, setAttendedSuccess] = useState<string | null>(null);

  const handleMarkAsAttended = (id: string, subject: string) => {
    setSugerencias(
      sugerencias.map((s) => (s.id === id ? { ...s, status: 'ATENDIDA' } : s))
    );
    setAttendedSuccess(`La sugerencia "${subject}" fue marcada como atendida.`);
    setTimeout(() => setAttendedSuccess(null), 3500);
  };

  const totalCount = sugerencias.length;
  const attendedCount = sugerencias.filter((s) => s.status === 'ATENDIDA').length;
  const pendingCount = sugerencias.filter((s) => s.status === 'PENDIENTE').length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Mail className="w-6 h-6 text-green-600" />
              Gestión de Sugerencias y Comentarios
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Revisión y atención de mensajes enviados por la comunidad SENA
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full">
              {attendedCount} Atendidas
            </span>
            <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">
              {pendingCount} Pendientes
            </span>
          </div>
        </div>

        {attendedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{attendedSuccess}</span>
          </div>
        )}

        {/* Top 3 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Total Recibidas</p>
              <p className="text-2xl font-black text-blue-950 mt-0.5">{totalCount}</p>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Atendidas</p>
              <p className="text-2xl font-black text-emerald-950 mt-0.5">{attendedCount}</p>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pendientes</p>
              <p className="text-2xl font-black text-amber-950 mt-0.5">{pendingCount}</p>
            </div>
          </div>
        </div>

        {/* List of Suggestions */}
        <div className="space-y-4 pt-2">
          {sugerencias.map((item) => {
            const isPending = item.status === 'PENDIENTE';

            return (
              <div
                key={item.id}
                className={`p-6 rounded-3xl border transition duration-200 space-y-3 ${
                  isPending
                    ? 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
                    : 'bg-gray-50/70 border-gray-200 hover:border-emerald-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/60 pb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {isPending ? 'Pendiente' : 'Atendida'}
                    </span>
                    <h3 className="text-base font-extrabold text-gray-900">
                      {item.subject}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{item.date}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed font-normal">
                  "{item.message}"
                </p>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-gray-500">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-bold text-gray-800">{item.author}</span>
                    <span className="text-gray-400">&middot;</span>
                    <Badge variant={item.role === 'Instructor' ? 'blue' : 'green'} className="text-[11px] py-0 px-2">
                      {item.role}
                    </Badge>
                    <span className="text-gray-400">&middot;</span>
                    <span>{item.fichaOrDoc}</span>
                  </div>

                  {isPending && (
                    <Button
                      variant="primary"
                      onClick={() => handleMarkAsAttended(item.id, item.subject)}
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      className="bg-green-600 hover:bg-green-700 text-xs py-1.5 px-3.5 font-bold"
                    >
                      Marcar como Atendida
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
