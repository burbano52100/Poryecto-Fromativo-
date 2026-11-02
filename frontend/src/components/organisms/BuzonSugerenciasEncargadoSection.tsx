import { useState } from 'react';
import { Mail, CheckCircle2, Clock, MessageSquare, User, Calendar, MessageSquareReply } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { LoadingSpinner } from '../atoms/LoadingSpinner';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { useResponderSugerencia, useSugerencias } from '../../hooks/useSugerencias';
import type { Sugerencia } from '../../types/api';

/** Buzón de gestión: recibe las sugerencias de aprendices, instructores e invitados. */
export const BuzonSugerenciasEncargadoSection = () => {
  const { data: sugerencias = [], isPending, isError, error, refetch } = useSugerencias();
  const responder = useResponderSugerencia();
  const [sugerenciaAResponder, setSugerenciaAResponder] = useState<Sugerencia | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [attendedSuccess, setAttendedSuccess] = useState<string | null>(null);

  const abrirRespuesta = (sugerencia: Sugerencia) => {
    responder.reset();
    setRespuesta('');
    setSugerenciaAResponder(sugerencia);
  };

  const confirmarRespuesta = () => {
    if (!sugerenciaAResponder) return;
    const { id, subject } = sugerenciaAResponder;
    responder.mutate(
      { id, respuesta: respuesta.trim() || undefined },
      {
        onSuccess: () => {
          setSugerenciaAResponder(null);
          setAttendedSuccess(`La sugerencia "${subject}" fue marcada como atendida.`);
          setTimeout(() => setAttendedSuccess(null), 3500);
        },
      }
    );
  };

  const totalCount = sugerencias.length;
  const attendedCount = sugerencias.filter((s) => s.status === 'ATENDIDA').length;
  const pendingCount = totalCount - attendedCount;

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
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full">{attendedCount} Atendidas</span>
            <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">{pendingCount} Pendientes</span>
          </div>
        </div>

        {attendedSuccess && (
          <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{attendedSuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Total Recibidas</p>
              <p className="text-2xl font-black text-blue-950 mt-0.5">{totalCount}</p>
            </div>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Atendidas</p>
              <p className="text-2xl font-black text-emerald-950 mt-0.5">{attendedCount}</p>
            </div>
          </div>
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pendientes</p>
              <p className="text-2xl font-black text-amber-950 mt-0.5">{pendingCount}</p>
            </div>
          </div>
        </div>

        {isPending ? (
          <LoadingSpinner label="Cargando sugerencias..." />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar las sugerencias" onReintentar={() => refetch()} />
        ) : sugerencias.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Aún no hay sugerencias en el buzón.</p>
        ) : (
          <div className="space-y-4 pt-2">
            {sugerencias.map((item) => {
              const isPending = item.status === 'PENDIENTE';
              return (
                <article
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
                      <h3 className="text-base font-extrabold text-gray-900">{item.subject}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{item.date}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed">"{item.message}"</p>

                  {item.respuesta && (
                    <p className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex gap-2">
                      <MessageSquareReply className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item.respuesta}</span>
                    </p>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-gray-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-bold text-gray-800">{item.author}</span>
                      <span className="text-gray-400">&middot;</span>
                      <Badge variant={item.role === 'Instructor' ? 'blue' : item.role === 'Invitado' ? 'amber' : 'green'} className="text-[11px] py-0 px-2">
                        {item.role}
                      </Badge>
                      <span className="text-gray-400">&middot;</span>
                      <span>{item.fichaOrDoc}</span>
                    </div>

                    {isPending && (
                      <Button
                        variant="primary"
                        onClick={() => abrirRespuesta(item)}
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        className="bg-green-600 hover:bg-green-700 text-xs py-1.5 px-3.5 font-bold"
                      >
                        Responder y marcar atendida
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        abierto={sugerenciaAResponder !== null}
        titulo="Responder sugerencia"
        icono={<MessageSquareReply className="w-8 h-8" />}
        textoConfirmar="Marcar como atendida"
        onConfirmar={confirmarRespuesta}
        onCancelar={() => setSugerenciaAResponder(null)}
        cargando={responder.isPending}
      >
        {sugerenciaAResponder && (
          <div className="space-y-3">
            <p className="font-bold text-gray-900">{sugerenciaAResponder.subject}</p>
            <label htmlFor="respuesta-sugerencia" className="block text-xs font-semibold text-gray-700">
              Respuesta para {sugerenciaAResponder.author} (opcional)
            </label>
            <textarea
              id="respuesta-sugerencia"
              rows={4}
              maxLength={1000}
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              placeholder="Gracias por tu sugerencia. Ya lo revisamos con el equipo de cocina."
              className="w-full rounded-xl p-3 text-sm bg-gray-50 border border-gray-200 focus:outline-none focus:border-emerald-500"
            />
            {responder.isError && <ErrorAlert error={responder.error} titulo="No se pudo guardar la respuesta" />}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};
