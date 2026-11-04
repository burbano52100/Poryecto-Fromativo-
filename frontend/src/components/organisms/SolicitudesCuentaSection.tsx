import { useState } from 'react';
import { UserPlus, CheckCircle2, XCircle, Mail, IdCard, Calendar, Inbox } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { LoadingSpinner } from '../atoms/LoadingSpinner';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { FormModal } from '../molecules/FormModal';
import { useAprobarSolicitud, useRechazarSolicitud, useSolicitudesCuenta } from '../../hooks/useSolicitudes';
import { fechaHora } from '../../lib/formato';
import type { EstadoSolicitud, SolicitudCuenta } from '../../types/api';

type Pestana = 'pendiente' | 'todas';

const ESTADO_BADGE: Record<EstadoSolicitud, { texto: string; variante: 'amber' | 'green' | 'red' }> = {
  pendiente: { texto: 'Pendiente', variante: 'amber' },
  aprobada: { texto: 'Aprobada', variante: 'green' },
  rechazada: { texto: 'Rechazada', variante: 'red' },
};

/**
 * Solicitudes de cuenta de instructor y encargado (ADR 015). Cualquier encargado las
 * aprueba (se crea el usuario y ya puede ingresar) o las rechaza con un motivo opcional.
 */
export const SolicitudesCuentaSection = () => {
  const [pestana, setPestana] = useState<Pestana>('pendiente');
  const { data: solicitudes = [], isPending, isError, error, refetch } = useSolicitudesCuenta(pestana);
  const aprobar = useAprobarSolicitud();
  const rechazar = useRechazarSolicitud();

  const [aAprobar, setAAprobar] = useState<SolicitudCuenta | null>(null);
  const [aRechazar, setARechazar] = useState<SolicitudCuenta | null>(null);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 4000);
  };

  const confirmarAprobacion = () => {
    if (!aAprobar) return;
    aprobar.mutate(aAprobar.id, {
      onSuccess: (res) => {
        setAAprobar(null);
        mostrarAviso(res.message);
      },
    });
  };

  const confirmarRechazo = () => {
    if (!aRechazar) return;
    rechazar.mutate(
      { id: aRechazar.id, motivo: motivo.trim() || undefined },
      {
        onSuccess: (res) => {
          setARechazar(null);
          mostrarAviso(res.message);
        },
      }
    );
  };

  const abrirRechazo = (solicitud: SolicitudCuenta) => {
    rechazar.reset();
    setMotivo('');
    setARechazar(solicitud);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-green-600" />
              Solicitudes de Cuenta
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Instructores y encargados que pidieron acceso. Al aprobar, la cuenta queda lista para ingresar.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50" role="tablist">
            {(
              [
                ['pendiente', 'Pendientes'],
                ['todas', 'Historial'],
              ] as const
            ).map(([id, texto]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
                  pestana === id ? 'bg-white text-green-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>

        {aviso && (
          <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{aviso}</span>
          </div>
        )}

        {isPending ? (
          <LoadingSpinner label="Cargando solicitudes..." />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar las solicitudes" onReintentar={() => refetch()} />
        ) : solicitudes.length === 0 ? (
          <div className="py-12 text-center text-gray-500 space-y-2">
            <Inbox className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-medium">
              {pestana === 'pendiente' ? 'No hay solicitudes pendientes.' : 'Todavía no hay solicitudes.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Solicitudes de cuenta">
            {solicitudes.map((s) => (
              <li
                key={s.id}
                className="rounded-2xl border border-gray-200/80 bg-gray-50/80 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-extrabold text-gray-900">{s.nombre}</h3>
                    <Badge variant="blue" className="capitalize">{s.rol}</Badge>
                    <Badge variant={ESTADO_BADGE[s.estado].variante}>{ESTADO_BADGE[s.estado].texto}</Badge>
                  </div>
                  <p className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <IdCard className="w-3.5 h-3.5" /> C.C. {s.documento}
                    </span>
                    <span className="inline-flex items-center gap-1 break-all">
                      <Mail className="w-3.5 h-3.5 shrink-0" /> {s.email}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {fechaHora(s.fecha)}
                    </span>
                  </p>
                  {s.estado !== 'pendiente' && (
                    <p className="text-xs text-gray-500">
                      {s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                      {s.revisado_por ? ` por ${s.revisado_por}` : ''}
                      {s.revisado_en ? ` el ${fechaHora(s.revisado_en)}` : ''}
                      {/* La hora ya termina en "a. m.", así que el motivo va con un separador y no con punto */}
                      {s.motivo_rechazo ? ` · Motivo: ${s.motivo_rechazo}` : ''}
                    </p>
                  )}
                </div>

                {s.estado === 'pendiente' && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => abrirRechazo(s)}
                      aria-label={`Rechazar solicitud de ${s.nombre}`}
                    >
                      <XCircle className="w-4 h-4 text-red-500" /> Rechazar
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        aprobar.reset();
                        setAAprobar(s);
                      }}
                      aria-label={`Aprobar solicitud de ${s.nombre}`}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Aprobar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        abierto={aAprobar !== null}
        titulo="Aprobar solicitud"
        icono={<UserPlus className="w-6 h-6" />}
        textoConfirmar="Aprobar y crear cuenta"
        onConfirmar={confirmarAprobacion}
        onCancelar={() => setAAprobar(null)}
        cargando={aprobar.isPending}
        variante="emerald"
      >
        <div className="space-y-3">
          <p>
            Se creará la cuenta de <strong>{aAprobar?.rol}</strong> para <strong>{aAprobar?.nombre}</strong> (C.C.{' '}
            {aAprobar?.documento}). Podrá ingresar con la contraseña que eligió al registrarse.
          </p>
          {aAprobar?.rol === 'encargado' && (
            <p className="text-xs font-semibold text-amber-700">
              Un encargado tiene acceso completo al panel: ventas, cartera, inventario y estas solicitudes.
            </p>
          )}
          {aprobar.isError && <ErrorAlert error={aprobar.error} titulo="No se pudo aprobar" />}
        </div>
      </ConfirmDialog>

      <FormModal abierto={aRechazar !== null} titulo="Rechazar solicitud" onCerrar={() => setARechazar(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmarRechazo();
          }}
          className="space-y-4"
        >
          <p className="text-sm text-gray-600">
            La solicitud de <strong>{aRechazar?.nombre}</strong> como {aRechazar?.rol} quedará rechazada. Si escribes un
            motivo, lo verá al intentar iniciar sesión.
          </p>
          {rechazar.isError && <ErrorAlert error={rechazar.error} titulo="No se pudo rechazar" />}
          <div className="space-y-1">
            <label htmlFor="motivo-rechazo" className="block text-xs font-semibold text-gray-700">
              Motivo (opcional)
            </label>
            <textarea
              id="motivo-rechazo"
              value={motivo}
              maxLength={300}
              rows={3}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: No pertenece al personal del comedor"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setARechazar(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={rechazar.isPending} className="bg-red-600 hover:bg-red-700 shadow-red-600/30">
              Rechazar solicitud
            </Button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
