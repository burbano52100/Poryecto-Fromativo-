import { useMemo, useState } from 'react';
import { CheckCircle2, UserPlus, XCircle } from 'lucide-react';
import { Avatar, Checkbox, Chip, toast } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { ConfirmDialog } from '../../molecules/ConfirmDialog';
import { EmptyMessage } from '../../molecules/EmptyMessage';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { FormModal } from '../../molecules/FormModal';
import { ListSkeleton } from '../../molecules/ListSkeleton';
import { SearchInput } from '../../molecules/SearchInput';
import { SectionCard } from '../../molecules/SectionCard';
import { iniciales } from '../../../lib/usuario';
import { TextAreaField } from '../../molecules/TextAreaField';
import { useAprobarSolicitudes, useRechazarSolicitudes, useSolicitudesCoordinador } from '../../../hooks/useCoordinador';
import { useDebounce } from '../../../hooks/useDebounce';
import { fechaHora } from '../../../lib/formato';
import type { CuentaGestionada } from '../../../types/api';

/** Las cuentas sobre las que se va a actuar: una fila o la selección completa. */
type Objetivo = CuentaGestionada[];

/**
 * Solicitudes de cuenta (ADR 018): aprendices e instructores que se registraron solos. El
 * Coordinador las aprueba (la cuenta queda activa) o las rechaza con un motivo que la persona ve al
 * intentar ingresar. Se puede actuar sobre una fila o sobre varias seleccionadas.
 */
export const SolicitudesCoordinadorSection = () => {
  const [busqueda, setBusqueda] = useState('');
  const { data: solicitudes = [], isPending, isError, error, refetch } = useSolicitudesCoordinador(
    useDebounce(busqueda.trim())
  );
  const aprobar = useAprobarSolicitudes();
  const rechazar = useRechazarSolicitudes();
  const mostrarAviso = (texto: string) => toast.success(texto);

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [aAprobar, setAAprobar] = useState<Objetivo | null>(null);
  const [aRechazar, setARechazar] = useState<Objetivo | null>(null);
  const [motivo, setMotivo] = useState('');

  // La selección solo conserva las solicitudes que siguen en la lista
  const seleccionadas = useMemo(() => solicitudes.filter((s) => seleccion.has(s.id)), [solicitudes, seleccion]);
  const todasMarcadas = solicitudes.length > 0 && seleccionadas.length === solicitudes.length;

  const alternar = (id: string) =>
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });

  const alternarTodas = () => setSeleccion(todasMarcadas ? new Set() : new Set(solicitudes.map((s) => s.id)));

  const terminar = (mensaje: string) => {
    setSeleccion(new Set());
    mostrarAviso(mensaje);
  };

  const abrirAprobacion = (objetivo: Objetivo) => {
    aprobar.reset();
    setAAprobar(objetivo);
  };

  const abrirRechazo = (objetivo: Objetivo) => {
    rechazar.reset();
    setMotivo('');
    setARechazar(objetivo);
  };

  const confirmarAprobacion = () => {
    if (!aAprobar) return;
    aprobar.mutate(
      aAprobar.map((s) => s.id),
      {
        onSuccess: (res) => {
          setAAprobar(null);
          terminar(res.message);
        },
      }
    );
  };

  const motivoValido = motivo.trim().length >= 3;
  const confirmarRechazo = () => {
    if (!aRechazar || !motivoValido) return;
    rechazar.mutate(
      { ids: aRechazar.map((s) => s.id), motivo: motivo.trim() },
      {
        onSuccess: (res) => {
          setARechazar(null);
          terminar(res.message);
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        titulo="Solicitudes de cuenta"
        descripcion="Aprendices e instructores que se registraron. Al aprobar, la cuenta queda activa y ya pueden ingresar."
        acciones={
          <SearchInput
            label="Buscar solicitudes"
            placeholder="Nombre, cédula o correo"
            value={busqueda}
            onChange={setBusqueda}
            className="w-full sm:w-72"
          />
        }
      >

        {solicitudes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-secondary px-4 py-3">
            <Checkbox
              isSelected={todasMarcadas}
              isIndeterminate={seleccionadas.length > 0 && !todasMarcadas}
              onChange={alternarTodas}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {seleccionadas.length > 0 ? `${seleccionadas.length} seleccionada(s)` : 'Seleccionar todas'}
              </Checkbox.Content>
            </Checkbox>
            <div className="flex gap-2">
              <Button variant="danger-soft" isDisabled={seleccionadas.length === 0} onPress={() => abrirRechazo(seleccionadas)}>
                <XCircle /> Rechazar selección
              </Button>
              <Button isDisabled={seleccionadas.length === 0} onPress={() => abrirAprobacion(seleccionadas)}>
                <CheckCircle2 /> Aprobar selección
              </Button>
            </div>
          </div>
        )}

        {isPending ? (
          <ListSkeleton label="Cargando solicitudes..." />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar las solicitudes" onReintentar={() => refetch()} />
        ) : solicitudes.length === 0 ? (
          <EmptyMessage>
            {busqueda.trim() ? 'Ninguna solicitud coincide con la búsqueda.' : 'No hay solicitudes pendientes.'}
          </EmptyMessage>
        ) : (
          <ul className="flex flex-col divide-y divide-separator" aria-label="Solicitudes pendientes">
            {solicitudes.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center">
                <Checkbox
                  aria-label={`Seleccionar a ${s.nombre}`}
                  isSelected={seleccion.has(s.id)}
                  onChange={() => alternar(s.id)}
                  className="self-start lg:self-center"
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox>
                <Avatar size="sm" variant="soft" color={s.rol === 'instructor' ? 'accent' : 'success'}>
                  <Avatar.Fallback>{iniciales(s.nombre)}</Avatar.Fallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground">{s.nombre}</h3>
                    <Chip size="sm" variant="soft" color={s.rol === 'instructor' ? 'accent' : 'success'} className="capitalize">
                      {s.rol}
                    </Chip>
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    <span>C.C. {s.cedula}</span>
                    {s.email && <span className="break-all">{s.email}</span>}
                    {s.ficha && (
                      <span>
                        Ficha {s.ficha}
                        {s.programa ? ` · ${s.programa}` : ''}
                      </span>
                    )}
                    <span>{fechaHora(s.created_at)}</span>
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="danger-soft"
                    onPress={() => abrirRechazo([s])}
                    aria-label={`Rechazar solicitud de ${s.nombre}`}
                  >
                    <XCircle /> Rechazar
                  </Button>
                  <Button size="sm" onPress={() => abrirAprobacion([s])} aria-label={`Aprobar solicitud de ${s.nombre}`}>
                    <CheckCircle2 /> Aprobar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ConfirmDialog
        abierto={aAprobar !== null}
        titulo="Aprobar solicitud"
        icono={<UserPlus className="size-5" />}
        textoConfirmar={aAprobar && aAprobar.length > 1 ? `Aprobar ${aAprobar.length} cuentas` : 'Aprobar cuenta'}
        onConfirmar={confirmarAprobacion}
        onCancelar={() => setAAprobar(null)}
        cargando={aprobar.isPending}
        variante="accent"
      >
        <div className="flex flex-col gap-3">
          <p>
            {aAprobar && aAprobar.length === 1 ? (
              <>
                La cuenta de <strong>{aAprobar[0].rol}</strong> de <strong>{aAprobar[0].nombre}</strong> (C.C.{' '}
                {aAprobar[0].cedula}) quedará activa.
              </>
            ) : (
              <>
                Las <strong>{aAprobar?.length}</strong> cuentas seleccionadas quedarán activas.
              </>
            )}{' '}
            Podrán ingresar con la contraseña que eligieron al registrarse.
          </p>
          {aprobar.isError && <ErrorAlert error={aprobar.error} titulo="No se pudo aprobar" />}
        </div>
      </ConfirmDialog>

      <FormModal abierto={aRechazar !== null} titulo="Rechazar solicitud" onCerrar={() => setARechazar(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmarRechazo();
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-muted">
            {aRechazar && aRechazar.length === 1 ? (
              <>
                <strong className="text-foreground">{aRechazar[0].nombre}</strong> no podrá ingresar.
              </>
            ) : (
              <>
                Las <strong className="text-foreground">{aRechazar?.length}</strong> solicitudes seleccionadas quedarán
                rechazadas.
              </>
            )}{' '}
            El motivo se muestra al intentar iniciar sesión.
          </p>
          {rechazar.isError && <ErrorAlert error={rechazar.error} titulo="No se pudo rechazar" />}
          <TextAreaField
            id="motivo-rechazo"
            label="Motivo del rechazo"
            value={motivo}
            maxLength={300}
            rows={3}
            required
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: No figura en la planta de instructores del centro"
            description="Mínimo 3 caracteres"
          />
          <div className="flex justify-end gap-2">
            <Button variant="tertiary" onPress={() => setARechazar(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" isDisabled={!motivoValido} isPending={rechazar.isPending}>
              Rechazar
            </Button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
