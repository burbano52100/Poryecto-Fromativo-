import { useState } from 'react';
import { FileSpreadsheet, FileText, KeyRound, UserCheck, UserX } from 'lucide-react';
import { Button as HeroButton, Chip, Input, Pagination, Table, Tooltip, toast } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { ConfirmDialog } from '../../molecules/ConfirmDialog';
import { EmptyMessage } from '../../molecules/EmptyMessage';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { ListSkeleton } from '../../molecules/ListSkeleton';
import { SearchInput } from '../../molecules/SearchInput';
import { SectionCard } from '../../molecules/SectionCard';
import { SelectField } from '../../molecules/SelectField';
import { useCambiarEstadoUsuario, useRestablecerClave, useUsuariosCoordinador } from '../../../hooks/useCoordinador';
import { useDebounce } from '../../../hooks/useDebounce';
import { descargarArchivo } from '../../../lib/descargas';
import type { CuentaGestionada, EstadoCuenta, RolGestionado } from '../../../types/api';

const TAMANO_PAGINA = 25;

const ESTADO_CHIP: Record<EstadoCuenta, { texto: string; color: 'success' | 'warning' | 'danger' | 'default' }> = {
  activo: { texto: 'Activo', color: 'success' },
  pendiente: { texto: 'Pendiente', color: 'warning' },
  inactivo: { texto: 'Inactivo', color: 'default' },
  rechazado: { texto: 'Rechazado', color: 'danger' },
};

/** Valor del Select que significa "sin filtro". */
const TODOS = 'todos';

type Accion = { tipo: 'activar' | 'desactivar' | 'clave'; cuenta: CuentaGestionada };

/**
 * Usuarios (ADR 018): instructores y aprendices con filtros. El Coordinador activa o desactiva
 * cuentas y restablece la contraseña (vuelve a ser la cédula, con cambio obligatorio al ingresar).
 */
export const UsuariosCoordinadorSection = () => {
  const [rol, setRol] = useState<RolGestionado | ''>('');
  const [estado, setEstado] = useState<EstadoCuenta | ''>('');
  const [ficha, setFicha] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const fichaEstable = useDebounce(ficha.trim());
  const busquedaEstable = useDebounce(busqueda.trim());

  const filtros = {
    rol: rol || undefined,
    estado: estado || undefined,
    ficha: fichaEstable || undefined,
    q: busquedaEstable || undefined,
  };
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useUsuariosCoordinador({
    ...filtros,
    pagina,
    tamano: TAMANO_PAGINA,
  });
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / TAMANO_PAGINA)) : 1;

  const cambiarEstado = useCambiarEstadoUsuario();
  const restablecer = useRestablecerClave();
  const [accion, setAccion] = useState<Accion | null>(null);
  const mostrarAviso = (texto: string) => toast.success(texto);
  const [errorReporte, setErrorReporte] = useState<unknown>(null);
  const [descargando, setDescargando] = useState<'pdf' | 'xlsx' | null>(null);

  /** Cambiar un filtro vuelve a la primera página. */
  const conFiltro =
    <T,>(asignar: (valor: T) => void) =>
    (valor: T) => {
      asignar(valor);
      setPagina(1);
    };

  const abrir = (siguiente: Accion) => {
    cambiarEstado.reset();
    restablecer.reset();
    setAccion(siguiente);
  };

  const confirmar = () => {
    if (!accion) return;
    const alTerminar = {
      onSuccess: (res: { message: string }) => {
        setAccion(null);
        mostrarAviso(res.message);
      },
    };
    if (accion.tipo === 'clave') restablecer.mutate(accion.cuenta.id, alTerminar);
    else cambiarEstado.mutate({ id: accion.cuenta.id, estado: accion.tipo === 'activar' ? 'activo' : 'inactivo' }, alTerminar);
  };

  const descargarReporte = async (formato: 'pdf' | 'xlsx') => {
    setErrorReporte(null);
    setDescargando(formato);
    try {
      await descargarArchivo('/reportes/usuarios', `reporte-usuarios.${formato}`, { formato, ...filtros });
    } catch (e) {
      setErrorReporte(e);
    } finally {
      setDescargando(null);
    }
  };

  const errorAccion = accion?.tipo === 'clave' ? restablecer.error : cambiarEstado.error;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        titulo="Usuarios"
        descripcion={`Instructores y aprendices del centro.${data ? ` ${data.total} cuenta(s) con estos filtros.` : ''}`}
        acciones={
          <>
            <Button variant="outline" isPending={descargando === 'pdf'} onPress={() => descargarReporte('pdf')}>
              <FileText /> PDF
            </Button>
            <Button variant="outline" isPending={descargando === 'xlsx'} onPress={() => descargarReporte('xlsx')}>
              <FileSpreadsheet /> Excel
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <SearchInput
            label="Buscar usuarios"
            placeholder="Nombre o cédula"
            value={busqueda}
            onChange={conFiltro(setBusqueda)}
            className="w-full"
          />
          <SelectField
            label="Rol"
            ocultarLabel
            value={rol || TODOS}
            onChange={(v) => conFiltro(setRol)(v === TODOS ? '' : (v as RolGestionado))}
            opciones={[
              { id: TODOS, label: 'Todos los roles' },
              { id: 'instructor', label: 'Instructores' },
              { id: 'aprendiz', label: 'Aprendices' },
            ]}
          />
          <SelectField
            label="Estado"
            ocultarLabel
            value={estado || TODOS}
            onChange={(v) => conFiltro(setEstado)(v === TODOS ? '' : (v as EstadoCuenta))}
            opciones={[
              { id: TODOS, label: 'Todos los estados' },
              { id: 'activo', label: 'Activos' },
              { id: 'inactivo', label: 'Inactivos' },
              { id: 'pendiente', label: 'Pendientes' },
              { id: 'rechazado', label: 'Rechazados' },
            ]}
          />
          <Input
            aria-label="Ficha"
            value={ficha}
            inputMode="numeric"
            fullWidth
            onChange={(e) => conFiltro(setFicha)(e.target.value.replace(/\D/g, ''))}
            placeholder="Ficha"
          />
        </div>

        {errorReporte !== null && (
          <ErrorAlert error={errorReporte} titulo="No se pudo descargar el reporte" onCerrar={() => setErrorReporte(null)} />
        )}

        {isPending ? (
          <ListSkeleton label="Cargando usuarios..." forma="tabla" />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar los usuarios" onReintentar={() => refetch()} />
        ) : (
          <Table variant="secondary" className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
            <Table.ScrollContainer>
              <Table.Content aria-label="Usuarios" className="min-w-[760px]">
                <Table.Header>
                  <Table.Column isRowHeader>Nombre</Table.Column>
                  <Table.Column>Cédula</Table.Column>
                  <Table.Column>Rol</Table.Column>
                  <Table.Column>Ficha</Table.Column>
                  <Table.Column>Estado</Table.Column>
                  <Table.Column className="text-right">Acciones</Table.Column>
                </Table.Header>
                <Table.Body renderEmptyState={() => <EmptyMessage>Ninguna cuenta coincide con los filtros.</EmptyMessage>}>
                  {data.items.map((u) => (
                    <Table.Row key={u.id} id={u.id}>
                      <Table.Cell>
                        <span className="font-medium text-foreground">{u.nombre}</span>
                        <span className="block break-all text-xs text-muted">{u.email || 'Sin correo'}</span>
                      </Table.Cell>
                      <Table.Cell className="tabular-nums">{u.cedula}</Table.Cell>
                      <Table.Cell className="capitalize">{u.rol}</Table.Cell>
                      <Table.Cell>{u.ficha ?? '—'}</Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-col items-start gap-1">
                          <Chip size="sm" variant="soft" color={ESTADO_CHIP[u.estado].color}>
                            {ESTADO_CHIP[u.estado].texto}
                          </Chip>
                          {u.debe_cambiar_clave && <span className="text-xs text-warning">Debe cambiar la clave</span>}
                          {u.origen === 'carga_masiva' && <span className="text-xs text-muted">Carga masiva</span>}
                          {u.estado === 'rechazado' && u.motivo_rechazo && (
                            <span className="max-w-48 text-xs text-muted">Motivo: {u.motivo_rechazo}</span>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {u.estado === 'activo' || u.estado === 'inactivo' ? (
                          <div className="flex justify-end gap-1.5">
                            <Tooltip delay={400}>
                              <HeroButton
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                onPress={() => abrir({ tipo: 'clave', cuenta: u })}
                                aria-label={`Restablecer la contraseña de ${u.nombre}`}
                              >
                                <KeyRound />
                              </HeroButton>
                              <Tooltip.Content>Restablecer contraseña</Tooltip.Content>
                            </Tooltip>
                            {u.estado === 'activo' ? (
                              <Button size="sm" variant="danger-soft" onPress={() => abrir({ tipo: 'desactivar', cuenta: u })}>
                                <UserX /> Desactivar
                              </Button>
                            ) : (
                              <Button size="sm" variant="secondary" onPress={() => abrir({ tipo: 'activar', cuenta: u })}>
                                <UserCheck /> Activar
                              </Button>
                            )}
                          </div>
                        ) : (
                          <p className="text-right text-xs text-muted">
                            {u.estado === 'pendiente' ? 'Revísala en Solicitudes' : 'Sin acciones'}
                          </p>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}

        {data && data.total > TAMANO_PAGINA && (
          <Pagination className="justify-between">
            <Pagination.Summary>
              Página {pagina} de {totalPaginas}
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous isDisabled={pagina <= 1} onPress={() => setPagina((p) => p - 1)}>
                  <Pagination.PreviousIcon />
                  <span>Anterior</span>
                </Pagination.Previous>
              </Pagination.Item>
              <Pagination.Item>
                <Pagination.Next isDisabled={pagina >= totalPaginas} onPress={() => setPagina((p) => p + 1)}>
                  <span>Siguiente</span>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        )}
      </SectionCard>

      <ConfirmDialog
        abierto={accion !== null}
        titulo={
          accion?.tipo === 'clave' ? 'Restablecer contraseña' : accion?.tipo === 'activar' ? 'Activar cuenta' : 'Desactivar cuenta'
        }
        icono={
          accion?.tipo === 'clave' ? (
            <KeyRound className="size-5" />
          ) : accion?.tipo === 'activar' ? (
            <UserCheck className="size-5" />
          ) : (
            <UserX className="size-5" />
          )
        }
        textoConfirmar={accion?.tipo === 'clave' ? 'Restablecer' : accion?.tipo === 'activar' ? 'Activar' : 'Desactivar'}
        variante={accion?.tipo === 'clave' ? 'warning' : accion?.tipo === 'activar' ? 'accent' : 'danger'}
        onConfirmar={confirmar}
        onCancelar={() => setAccion(null)}
        cargando={cambiarEstado.isPending || restablecer.isPending}
      >
        <div className="flex flex-col gap-3">
          {accion?.tipo === 'clave' && (
            <p>
              La contraseña de <strong>{accion.cuenta.nombre}</strong> volverá a ser su número de documento (
              {accion.cuenta.cedula}) y deberá cambiarla al ingresar.
            </p>
          )}
          {accion?.tipo === 'activar' && (
            <p>
              <strong>{accion.cuenta.nombre}</strong> podrá volver a ingresar a GastroSENA.
            </p>
          )}
          {accion?.tipo === 'desactivar' && (
            <>
              <p>
                <strong>{accion.cuenta.nombre}</strong> no podrá ingresar mientras la cuenta esté inactiva.
              </p>
              {accion.cuenta.rol === 'aprendiz' && (
                <p className="text-xs text-warning">Si tiene beneficio de almuerzo, se finalizará y se avisará al Encargado.</p>
              )}
            </>
          )}
          {errorAccion && <ErrorAlert error={errorAccion} titulo="No se pudo completar la acción" />}
        </div>
      </ConfirmDialog>
    </div>
  );
};
