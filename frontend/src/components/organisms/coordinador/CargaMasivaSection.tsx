import { Fragment, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, MinusCircle, Paperclip } from 'lucide-react';
import { Alert, Card, Chip, Separator, Table, ToggleButton, ToggleButtonGroup } from '@heroui/react';

import { Button } from '../../atoms/Button';
import { EmptyMessage } from '../../molecules/EmptyMessage';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { ListSkeleton } from '../../molecules/ListSkeleton';
import { SectionCard } from '../../molecules/SectionCard';
import { FranjaCifras } from '../../molecules/FranjaCifras';
import { useConfirmarCarga, useHistorialCargas, usePrevisualizarCarga } from '../../../hooks/useCoordinador';
import { descargarArchivo } from '../../../lib/descargas';
import { fechaHora } from '../../../lib/formato';
import type { TipoCarga } from '../../../types/api';

const ESTADO_FILA = {
  valida: { texto: 'Válida', color: 'success' },
  omitida: { texto: 'Se omite', color: 'warning' },
  error: { texto: 'Con error', color: 'danger' },
} as const;

const Paso = ({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) => (
  <li>
    <Card variant="secondary" className="h-full gap-3">
      <Card.Header className="flex-row items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-foreground">
          {numero}
        </span>
        <Card.Title>{titulo}</Card.Title>
      </Card.Header>
      <Card.Content className="gap-3">{children}</Card.Content>
    </Card>
  </li>
);

/**
 * Carga masiva (ADR 018): el Coordinador sube un Excel o CSV con instructores o aprendices. Primero
 * se revisa (no crea nada) y, al confirmar, las filas válidas quedan como cuentas activas con la
 * cédula como contraseña inicial y cambio obligatorio al primer ingreso.
 */
export const CargaMasivaSection = () => {
  const [tipo, setTipo] = useState<TipoCarga>('aprendices');
  const [archivo, setArchivo] = useState<File | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const previsualizar = usePrevisualizarCarga();
  const confirmar = useConfirmarCarga();
  const historial = useHistorialCargas();
  const [errorDescarga, setErrorDescarga] = useState<unknown>(null);

  const reiniciar = () => {
    previsualizar.reset();
    confirmar.reset();
  };

  const elegirTipo = (nuevo: TipoCarga) => {
    setTipo(nuevo);
    setArchivo(null);
    if (entrada.current) entrada.current.value = '';
    reiniciar();
  };

  const descargar = async (url: string, nombre: string) => {
    setErrorDescarga(null);
    try {
      await descargarArchivo(url, nombre);
    } catch (e) {
      setErrorDescarga(e);
    }
  };

  const vista = previsualizar.data;
  const resultado = confirmar.data;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        titulo="Carga masiva"
        descripcion="Crea cuentas desde un Excel (.xlsx) o CSV. La contraseña inicial es la cédula y se cambia al primer ingreso."
        acciones={
          <ToggleButtonGroup
            aria-label="Tipo de carga"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[tipo]}
            onSelectionChange={(keys) => {
              const [nuevo] = keys;
              if (nuevo) elegirTipo(nuevo as TipoCarga);
            }}
          >
            <ToggleButton id="aprendices">Aprendices</ToggleButton>
            <ToggleButton id="instructores">
              <ToggleButtonGroup.Separator />
              Instructores
            </ToggleButton>
          </ToggleButtonGroup>
        }
      >
        <ol className="grid gap-3 text-sm lg:grid-cols-3">
          <Paso numero={1} titulo="Descarga la plantilla">
            <p className="text-xs text-muted">
              {tipo === 'aprendices'
                ? 'Columnas: nombre, cédula, correo y ficha (programa y jornada son opcionales)'
                : 'Columnas: nombre, cédula y correo (el teléfono es opcional)'}
            </p>
            <Button
              variant="outline"
              className="self-start"
              onPress={() => descargar(`/coordinador/cargas/plantilla/${tipo}`, `plantilla-${tipo}.xlsx`)}
            >
              <Download /> Plantilla de {tipo}
            </Button>
          </Paso>
          <Paso numero={2} titulo="Elige el archivo">
            <input
              ref={entrada}
              id="archivo-carga"
              type="file"
              accept=".xlsx,.csv"
              aria-label="Archivo de la carga masiva"
              className="sr-only"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                reiniciar();
              }}
            />
            <Button variant="outline" className="self-start" onPress={() => entrada.current?.click()}>
              <Paperclip /> {archivo ? 'Cambiar archivo' : 'Seleccionar archivo'}
            </Button>
            <p className="break-all text-xs text-muted">{archivo ? archivo.name : 'Máximo 5 MB'}</p>
          </Paso>
          <Paso numero={3} titulo="Revisa y confirma">
            <p className="text-xs text-muted">La revisión no crea nada: muestra qué filas se crearán y cuáles tienen errores.</p>
            <Button
              className="self-start"
              isDisabled={!archivo}
              isPending={previsualizar.isPending}
              onPress={() => {
                if (!archivo) return;
                confirmar.reset();
                previsualizar.mutate({ tipo, archivo });
              }}
            >
              <FileSpreadsheet /> Revisar archivo
            </Button>
          </Paso>
        </ol>

        {errorDescarga !== null && (
          <ErrorAlert error={errorDescarga} titulo="No se pudo descargar el archivo" onCerrar={() => setErrorDescarga(null)} />
        )}
        {previsualizar.isError && <ErrorAlert error={previsualizar.error} titulo="No se pudo revisar el archivo" />}
        {confirmar.isError && <ErrorAlert error={confirmar.error} titulo="No se pudo completar la carga" />}

        {resultado ? (
          <div className="flex flex-col gap-4" role="status">
            <Alert status="success">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  Carga terminada: {resultado.resumen.creados} cuenta(s) creada(s) de {resultado.resumen.total_filas} fila(s).
                </Alert.Title>
              </Alert.Content>
            </Alert>
            <FranjaCifras
              sinTarjeta
              etiqueta="Resultado de la carga"
              cifras={[
                { etiqueta: 'Creadas', valor: resultado.resumen.creados },
                { etiqueta: 'Omitidas', valor: resultado.resumen.omitidos },
                { etiqueta: 'Con error', valor: resultado.resumen.con_error },
              ]}
            />
            <Button
              variant="outline"
              className="self-start"
              onPress={() => descargar(`/coordinador/cargas/${resultado.id}/resultado`, `resultado-carga-${resultado.tipo}.xlsx`)}
            >
              <Download /> Descargar el resultado fila por fila
            </Button>
          </div>
        ) : (
          vista && (
            <div className="flex flex-col gap-4">
              <FranjaCifras
                sinTarjeta
                etiqueta="Revisión del archivo"
                cifras={[
                  { etiqueta: 'Filas', valor: vista.resumen.total },
                  { etiqueta: 'Válidas', valor: vista.resumen.validas },
                  { etiqueta: 'Se omiten', valor: vista.resumen.omitidas },
                  { etiqueta: 'Con error', valor: vista.resumen.errores },
                ]}
              />

              <Table variant="secondary">
                <Table.ScrollContainer className="max-h-96">
                  <Table.Content aria-label="Revisión del archivo" className="min-w-[640px] text-xs">
                    <Table.Header>
                      <Table.Column>Fila</Table.Column>
                      <Table.Column isRowHeader>Nombre</Table.Column>
                      <Table.Column>Cédula</Table.Column>
                      {tipo === 'aprendices' ? <Table.Column>Ficha</Table.Column> : null}
                      <Table.Column>Estado</Table.Column>
                      <Table.Column>Detalle</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {vista.filas.map((f) => (
                        <Table.Row key={f.fila} id={String(f.fila)}>
                          <Table.Cell className="tabular-nums text-muted">{f.fila}</Table.Cell>
                          <Table.Cell className="font-medium text-foreground">{f.datos.nombre || '—'}</Table.Cell>
                          <Table.Cell className="tabular-nums">{f.datos.cedula || '—'}</Table.Cell>
                          {tipo === 'aprendices' ? <Table.Cell>{f.datos.ficha || '—'}</Table.Cell> : null}
                          <Table.Cell>
                            <Chip size="sm" variant="soft" color={ESTADO_FILA[f.estado].color}>
                              {ESTADO_FILA[f.estado].texto}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>{f.mensajes.join('. ') || '—'}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  {vista.resumen.validas > 0 ? (
                    <>
                      <MinusCircle className="size-4" /> Las filas omitidas o con error no se crean.
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-4 text-warning" /> Ninguna fila es válida: corrige el archivo y vuelve
                      a revisarlo.
                    </>
                  )}
                </p>
                <Button
                  isDisabled={!archivo || vista.resumen.validas === 0}
                  isPending={confirmar.isPending}
                  onPress={() => archivo && confirmar.mutate({ tipo, archivo })}
                >
                  <CheckCircle2 /> Crear {vista.resumen.validas} cuenta(s)
                </Button>
              </div>
            </div>
          )
        )}
      </SectionCard>

      <SectionCard titulo="Historial de cargas">
        {historial.isPending ? (
          <ListSkeleton label="Cargando historial..." filas={3} />
        ) : historial.isError ? (
          <ErrorAlert error={historial.error} titulo="No se pudo cargar el historial" onReintentar={() => historial.refetch()} />
        ) : historial.data.length === 0 ? (
          <EmptyMessage>Todavía no se ha hecho ninguna carga masiva.</EmptyMessage>
        ) : (
          <ul aria-label="Historial de cargas">
            {historial.data.map((c, i) => (
              <Fragment key={c.id}>
                {i > 0 && <Separator />}
                <li className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-foreground">{c.archivo}</p>
                    <p className="text-xs text-muted">
                      <span className="capitalize">{c.tipo}</span> · {fechaHora(c.fecha_hora)}
                      {c.coordinador ? ` · ${c.coordinador}` : ''} · {c.creados} creada(s), {c.omitidos} omitida(s),{' '}
                      {c.con_error} con error
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => descargar(`/coordinador/cargas/${c.id}/resultado`, `resultado-carga-${c.tipo}.xlsx`)}
                  >
                    <Download /> Resultado
                  </Button>
                </li>
              </Fragment>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
};
