import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Package, Search, Plus, ArrowDownCircle, ArrowUpCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '../../atoms/Button';
import { Badge } from '../../atoms/Badge';
import { LoadingSpinner } from '../../atoms/LoadingSpinner';
import { FormField } from '../../molecules/FormField';
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

const COLOR_ESTADO: Record<EstadoMaterial, 'green' | 'amber' | 'red' | 'blue'> = {
  Bueno: 'green',
  Bajo: 'amber',
  Crítico: 'red',
  Venciendo: 'red',
};

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
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {crear.isError && <ErrorAlert error={crear.error} titulo="No se pudo crear el material" />}
      <FormField label="Nombre del Material" required placeholder="Ej: Harina de Trigo 1kg" error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-2 gap-3">
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
      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" isLoading={crear.isPending} className="font-bold">
          Guardar Material
        </Button>
      </div>
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
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm text-gray-600">
        Stock actual: <span className="font-bold">{material.stock} {material.unit}</span>
      </p>
      {entrada.isError && <ErrorAlert error={entrada.error} titulo="No se pudo registrar la entrada" />}
      <FormField label={`Cantidad (${material.unit})`} required error={errors.cantidad?.message} {...soloNumeros(register('cantidad'))} />
      <FormField
        label="Nuevo costo unitario"
       
        placeholder={`Actual: ${pesos(material.costo)}`}
        error={errors.costo_unitario?.message}
        {...soloNumeros(register('costo_unitario'))}
      />
      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" isLoading={entrada.isPending} className="font-bold">
          Registrar Entrada
        </Button>
      </div>
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
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm text-gray-600">
        Stock actual: <span className="font-bold">{material.stock} {material.unit}</span>
      </p>
      {salida.isError && <ErrorAlert error={salida.error} titulo="No se pudo registrar la salida" />}
      <FormField label={`Cantidad (${material.unit})`} required error={errors.cantidad?.message} {...soloNumeros(register('cantidad'))} />
      <FormField label="Concepto" required error={errors.concepto?.message} {...register('concepto')} />
      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" isLoading={salida.isPending} className="font-bold bg-red-600 hover:bg-red-700 shadow-red-600/30">
          Registrar Salida
        </Button>
      </div>
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
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-green-600" />
            Control de Stock e Inventario
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Monitoreo de materias primas e insumos del comedor escolar</p>
        </div>

        <Button variant="primary" onClick={() => setCreando(true)} icon={<Plus className="w-4 h-4" />} className="font-bold">
          Agregar Material
        </Button>
      </div>

      {aviso && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}
      {eliminar.isError && (
        <ErrorAlert error={eliminar.error} titulo="No se pudo eliminar el material" onCerrar={() => eliminar.reset()} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
          <input
            type="search"
            aria-label="Buscar material"
            placeholder="Buscar artículo o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          />
        </div>
        <select
          aria-label="Filtrar por estado"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoMaterial | 'todos')}
          className="bg-white border border-gray-300 rounded-2xl px-3 py-2.5 text-sm font-medium"
        >
          <option value="todos">Todos los estados</option>
          <option value="Bueno">Bueno</option>
          <option value="Bajo">Bajo</option>
          <option value="Crítico">Crítico</option>
          <option value="Venciendo">Venciendo</option>
        </select>
      </div>

      {isPending ? (
        <LoadingSpinner label="Cargando inventario..." />
      ) : isError ? (
        <ErrorAlert error={error} titulo="No se pudo cargar el inventario" onReintentar={() => refetch()} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Artículo</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-medium">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No hay materiales que coincidan.
                  </td>
                </tr>
              ) : (
                filtrados.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{m.code}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      {m.name}
                      <span className="block text-xs font-normal text-gray-400">
                        Mín. {m.stock_minimo} {m.unit} · {pesos(m.costo)}/{m.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">{m.category ?? '—'}</td>
                    <td className="py-3.5 px-4 text-gray-500 text-xs">{m.expiry ?? '—'}</td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700 whitespace-nowrap">
                      {m.stock} {m.unit}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={COLOR_ESTADO[m.estado]}>{m.estado}</Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Registrar entrada"
                          aria-label={`Registrar entrada de ${m.name}`}
                          onClick={() => setMovimiento({ tipo: 'entrada', material: m })}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                        >
                          <ArrowDownCircle className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          title="Registrar salida"
                          aria-label={`Registrar salida de ${m.name}`}
                          onClick={() => setMovimiento({ tipo: 'salida', material: m })}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 cursor-pointer"
                        >
                          <ArrowUpCircle className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          title="Eliminar material"
                          aria-label={`Eliminar ${m.name}`}
                          onClick={() => setAEliminar(m)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <FormModal abierto={creando} titulo="Agregar Nuevo Material al Stock" onCerrar={() => setCreando(false)} ancho="lg">
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
        icono={<Trash2 className="w-8 h-8" />}
        variante="red"
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
        <p className="text-center">
          ¿Eliminar <span className="font-bold text-gray-900">{aEliminar?.name}</span>? Su historial del Kardex se conserva. No se
          puede eliminar si lo usa una receta activa.
        </p>
      </ConfirmDialog>
    </div>
  );
};
