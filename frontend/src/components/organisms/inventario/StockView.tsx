import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2 } from 'lucide-react';
import { Alert, Button as HeroButton, Chip, Table, Tooltip } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { EmptyMessage } from '../../molecules/EmptyMessage';
import { FormField } from '../../molecules/FormField';
import { ListSkeleton } from '../../molecules/ListSkeleton';
import { SearchInput } from '../../molecules/SearchInput';
import { SectionCard } from '../../molecules/SectionCard';
import { SelectField } from '../../molecules/SelectField';
import { FormModal } from '../../molecules/FormModal';
import { ConfirmDialog } from '../../molecules/ConfirmDialog';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import {
  useCrearMaterial,
  useEliminarMaterial,
  useMateriales,
  useRegistrarEntrada,
  useRegistrarSalida,
} from '../../../hooks/useInventario';
import {
  entradaSchema,
  materialSchema,
  salidaSchema,
  type EntradaData,
  type EntradaForm,
  type MaterialData,
  type MaterialForm,
  type SalidaData,
  type SalidaForm,
} from '../../../schemas/inventario.schema';
import { pesos } from '../../../lib/formato';
import { soloNumeros } from '../../../lib/numeros';
import type { EstadoMaterial, Material } from '../../../types/api';

const COLOR_ESTADO: Record<EstadoMaterial, 'success' | 'warning' | 'danger'> = {
  Bueno: 'success',
  Bajo: 'warning',
  Crítico: 'danger',
  Venciendo: 'danger',
};

const ESTADOS: EstadoMaterial[] = ['Bueno', 'Bajo', 'Crítico', 'Venciendo'];

/** Botón de icono con tooltip para las acciones de cada fila. */
const Accion = ({
  etiqueta,
  ayuda,
  onPress,
  className,
  children,
}: {
  etiqueta: string;
  ayuda: string;
  onPress: () => void;
  className?: string;
  children: React.ReactNode;
}) => (
  <Tooltip delay={400}>
    <HeroButton isIconOnly size="sm" variant="ghost" aria-label={etiqueta} onPress={onPress} className={className}>
      {children}
    </HeroButton>
    <Tooltip.Content>{ayuda}</Tooltip.Content>
  </Tooltip>
);

const FormularioMaterial = ({ categorias, onListo }: { categorias: string[]; onListo: (nombre: string) => void }) => {
  const crear = useCrearMaterial();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MaterialForm, unknown, MaterialData>({
    resolver: zodResolver(materialSchema),
    defaultValues: { name: '', code: '', category: '', unit: 'Kg', expiry: '', stock: '', stock_minimo: '10', costo_unitario: '0' },
  });

  const onSubmit = handleSubmit((data) =>
    crear.mutate(
      { ...data, code: data.code || undefined, expiry: data.expiry || undefined },
      { onSuccess: () => onListo(data.name) }
    )
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {crear.isError && <ErrorAlert error={crear.error} titulo="No se pudo crear el material" />}
      <FormField label="Nombre del Material" required placeholder="Ej: Harina de Trigo 1kg" error={errors.name?.message} {...register('name')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Código de barras" placeholder="Opcional" error={errors.code?.message} {...register('code')} />
        <FormField
          label="Categoría"
          required
          list="categorias-material"
          placeholder="Ej: Granos"
          error={errors.category?.message}
          {...register('category')}
        />
        <datalist id="categorias-material">
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <FormField label="Unidad" required placeholder="Kg, Litros, Unidades" error={errors.unit?.message} {...register('unit')} />
        <FormField label="Vencimiento" type="date" error={errors.expiry?.message} {...register('expiry')} />
        <FormField label="Stock inicial" required error={errors.stock?.message} {...soloNumeros(register('stock'))} />
        <FormField label="Stock mínimo" required error={errors.stock_minimo?.message} {...soloNumeros(register('stock_minimo'))} />
        <FormField label="Costo unitario" required error={errors.costo_unitario?.message} {...soloNumeros(register('costo_unitario'))} />
      </div>
      <Button type="submit" isPending={crear.isPending} className="self-end">
        Guardar Material
      </Button>
    </form>
  );
};

const FormularioEntrada = ({ material, onListo }: { material: Material; onListo: () => void }) => {
  const entrada = useRegistrarEntrada();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntradaForm, unknown, EntradaData>({
    resolver: zodResolver(entradaSchema),
    defaultValues: { cantidad: '', costo_unitario: '' },
  });

  const onSubmit = handleSubmit((data) => entrada.mutate({ id: material.id, ...data }, { onSuccess: onListo }));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Stock actual:{' '}
        <span className="font-medium text-foreground">
          {material.stock} {material.unit}
        </span>
      </p>
      {entrada.isError && <ErrorAlert error={entrada.error} titulo="No se pudo registrar la entrada" />}
      <FormField label={`Cantidad (${material.unit})`} required error={errors.cantidad?.message} {...soloNumeros(register('cantidad'))} />
      <FormField
        label="Nuevo costo unitario"
        placeholder={`Actual: ${pesos(material.costo)}`}
        error={errors.costo_unitario?.message}
        {...soloNumeros(register('costo_unitario'))}
      />
      <Button type="submit" isPending={entrada.isPending} className="self-end">
        Registrar Entrada
      </Button>
    </form>
  );
};

const FormularioSalida = ({ material, onListo }: { material: Material; onListo: () => void }) => {
  const salida = useRegistrarSalida();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SalidaForm, unknown, SalidaData>({
    resolver: zodResolver(salidaSchema),
    defaultValues: { cantidad: '', concepto: 'Preparación de almuerzos' },
  });

  const onSubmit = handleSubmit((data) => salida.mutate({ id: material.id, ...data }, { onSuccess: onListo }));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Stock actual:{' '}
        <span className="font-medium text-foreground">
          {material.stock} {material.unit}
        </span>
      </p>
      {salida.isError && <ErrorAlert error={salida.error} titulo="No se pudo registrar la salida" />}
      <FormField label={`Cantidad (${material.unit})`} required error={errors.cantidad?.message} {...soloNumeros(register('cantidad'))} />
      <FormField label="Concepto" required error={errors.concepto?.message} {...register('concepto')} />
      <Button type="submit" variant="danger" isPending={salida.isPending} className="self-end">
        Registrar Salida
      </Button>
    </form>
  );
};

type Movimiento = { tipo: 'entrada' | 'salida'; material: Material };

export const StockView = () => {
  const { data: materiales = [], isPending, isError, error, refetch } = useMateriales();
  const eliminar = useEliminarMaterial();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoMaterial | 'todos'>('todos');
  const [creando, setCreando] = useState(false);
  const [movimiento, setMovimiento] = useState<Movimiento | null>(null);
  const [aEliminar, setAEliminar] = useState<Material | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3500);
  };

  const categorias = [...new Set(materiales.map((m) => m.category).filter((c): c is string => !!c))].sort();
  const termino = busqueda.toLowerCase();
  const filtrados = materiales.filter(
    (m) =>
      (filtroEstado === 'todos' || m.estado === filtroEstado) &&
      (m.name.toLowerCase().includes(termino) || m.code.includes(busqueda))
  );

  return (
    <SectionCard
      titulo="Control de stock"
      descripcion="Materias primas e insumos del comedor"
      acciones={
        <Button onPress={() => setCreando(true)}>
          <Plus />
          Agregar Material
        </Button>
      }
    >
      {aviso && (
        <Alert status="success" role="status">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{aviso}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {eliminar.isError && (
        <ErrorAlert error={eliminar.error} titulo="No se pudo eliminar el material" onCerrar={() => eliminar.reset()} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label="Buscar material"
          placeholder="Buscar artículo o código..."
          value={busqueda}
          onChange={setBusqueda}
          className="min-w-[200px] flex-1"
        />
        <SelectField
          label="Filtrar por estado"
          ocultarLabel
          className="w-48"
          value={filtroEstado}
          onChange={(v) => setFiltroEstado((v || 'todos') as EstadoMaterial | 'todos')}
          opciones={[{ id: 'todos', label: 'Todos los estados' }, ...ESTADOS.map((e) => ({ id: e, label: e }))]}
        />
      </div>

      {isPending ? (
        <ListSkeleton label="Cargando inventario..." forma="tabla" />
      ) : isError ? (
        <ErrorAlert error={error} titulo="No se pudo cargar el inventario" onReintentar={() => refetch()} />
      ) : (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Materiales del inventario" className="min-w-[820px]">
              <Table.Header>
                <Table.Column>Código</Table.Column>
                <Table.Column isRowHeader>Artículo</Table.Column>
                <Table.Column>Categoría</Table.Column>
                <Table.Column>Vencimiento</Table.Column>
                <Table.Column className="text-right">Stock</Table.Column>
                <Table.Column>Estado</Table.Column>
                <Table.Column className="text-right">Acciones</Table.Column>
              </Table.Header>
              <Table.Body renderEmptyState={() => <EmptyMessage>No hay materiales que coincidan.</EmptyMessage>}>
                {filtrados.map((m) => (
                  <Table.Row key={m.id} id={m.id}>
                    <Table.Cell className="font-mono text-xs text-muted">{m.code}</Table.Cell>
                    <Table.Cell>
                      <span className="font-medium text-foreground">{m.name}</span>
                      <span className="block text-xs text-muted">
                        Mín. {m.stock_minimo} {m.unit} · {pesos(m.costo)}/{m.unit}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{m.category ?? '—'}</Table.Cell>
                    <Table.Cell className="text-xs">{m.expiry ?? '—'}</Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">
                      {m.stock} {m.unit}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={COLOR_ESTADO[m.estado]}>
                        {m.estado}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <Accion
                          etiqueta={`Registrar entrada de ${m.name}`}
                          ayuda="Registrar entrada"
                          className="text-success"
                          onPress={() => setMovimiento({ tipo: 'entrada', material: m })}
                        >
                          <ArrowDownCircle />
                        </Accion>
                        <Accion
                          etiqueta={`Registrar salida de ${m.name}`}
                          ayuda="Registrar salida"
                          className="text-warning"
                          onPress={() => setMovimiento({ tipo: 'salida', material: m })}
                        >
                          <ArrowUpCircle />
                        </Accion>
                        <Accion
                          etiqueta={`Eliminar ${m.name}`}
                          ayuda="Eliminar material"
                          className="text-danger"
                          onPress={() => setAEliminar(m)}
                        >
                          <Trash2 />
                        </Accion>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      <FormModal abierto={creando} titulo="Agregar nuevo material" onCerrar={() => setCreando(false)} ancho="lg">
        <FormularioMaterial
          categorias={categorias}
          onListo={(nombre) => {
            setCreando(false);
            mostrarAviso(`Material ${nombre} agregado. Su stock inicial quedó en el Kardex.`);
          }}
        />
      </FormModal>

      <FormModal
        abierto={movimiento !== null}
        titulo={movimiento ? `${movimiento.tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${movimiento.material.name}` : ''}
        onCerrar={() => setMovimiento(null)}
      >
        {movimiento?.tipo === 'entrada' && (
          <FormularioEntrada
            material={movimiento.material}
            onListo={() => {
              setMovimiento(null);
              mostrarAviso('Entrada registrada en el Kardex.');
            }}
          />
        )}
        {movimiento?.tipo === 'salida' && (
          <FormularioSalida
            material={movimiento.material}
            onListo={() => {
              setMovimiento(null);
              mostrarAviso('Salida registrada en el Kardex.');
            }}
          />
        )}
      </FormModal>

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar material"
        icono={<Trash2 className="size-5" />}
        variante="danger"
        textoConfirmar="Sí, eliminar"
        cargando={eliminar.isPending}
        onCancelar={() => setAEliminar(null)}
        onConfirmar={() =>
          aEliminar &&
          eliminar.mutate(aEliminar.id, {
            onSuccess: () => mostrarAviso(`${aEliminar.name} se eliminó del inventario.`),
            onSettled: () => setAEliminar(null),
          })
        }
      >
        <p>
          ¿Eliminar <span className="font-medium text-foreground">{aEliminar?.name}</span>? Su historial del Kardex se
          conserva. No se puede eliminar si lo usa una receta activa.
        </p>
      </ConfirmDialog>
    </SectionCard>
  );
};
