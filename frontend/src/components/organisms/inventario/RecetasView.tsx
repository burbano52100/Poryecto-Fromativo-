import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChefHat, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../atoms/Button';
import { LoadingSpinner } from '../../atoms/LoadingSpinner';
import { FormField } from '../../molecules/FormField';
import { FormModal } from '../../molecules/FormModal';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { useActualizarReceta, useCrearReceta, useMateriales, useRecetas } from '../../../hooks/useInventario';
import { recetaSchema, type RecetaData, type RecetaForm } from '../../../schemas/inventario.schema';
import { pesos } from '../../../lib/formato';
import { soloNumeros } from '../../../lib/numeros';
import type { Receta } from '../../../types/api';

const FormularioReceta = ({ receta, onListo }: { receta: Receta | null; onListo: () => void }) => {
  const { data: materiales = [] } = useMateriales();
  const crear = useCrearReceta();
  const actualizar = useActualizarReceta();
  const mutacion = receta ? actualizar : crear;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RecetaForm, unknown, RecetaData>({
    resolver: zodResolver(recetaSchema),
    defaultValues: receta
      ? {
          name: receta.name,
          code: receta.code ?? '',
          price: String(receta.price),
          ingredients: receta.ingredients.map((i) => ({ material_id: i.material_id, cantidad: String(i.cantidad) })),
        }
      : { name: '', code: '', price: '5000', ingredients: [{ material_id: '', cantidad: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'ingredients' });

  const onSubmit = handleSubmit((data) => {
    const payload = { ...data, code: data.code || undefined };
    if (receta) actualizar.mutate({ id: receta.id, receta: payload }, { onSuccess: onListo });
    else crear.mutate(payload, { onSuccess: onListo });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {mutacion.isError && <ErrorAlert error={mutacion.error} titulo="No se pudo guardar la receta" />}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Nombre del plato" required className="sm:col-span-2" error={errors.name?.message} {...register('name')} />
        <FormField label="Código" placeholder="REC-003" error={errors.code?.message} {...register('code')} />
        <FormField label="Precio de venta" required error={errors.price?.message} {...soloNumeros(register('price'), 'entero')} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-gray-800">Ingredientes por porción</p>
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="flex-1">
              <label htmlFor={`ing-material-${index}`} className="sr-only">
                Material del ingrediente {index + 1}
              </label>
              <select
                id={`ing-material-${index}`}
                {...register(`ingredients.${index}.material_id`)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              >
                <option value="">Selecciona material…</option>
                {materiales.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
              {errors.ingredients?.[index]?.material_id && (
                <p className="text-xs text-red-500 font-medium pl-1">{errors.ingredients[index]?.material_id?.message}</p>
              )}
            </div>
            <div className="w-28">
              <label htmlFor={`ing-cantidad-${index}`} className="sr-only">
                Cantidad del ingrediente {index + 1}
              </label>
              <input
                id={`ing-cantidad-${index}`}
                placeholder="0.250"
                {...soloNumeros(register(`ingredients.${index}.cantidad`))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
              {errors.ingredients?.[index]?.cantidad && (
                <p className="text-xs text-red-500 font-medium pl-1">{errors.ingredients[index]?.cantidad?.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
              aria-label={`Quitar ingrediente ${index + 1}`}
              className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {errors.ingredients?.root?.message && <p className="text-xs text-red-500 font-medium">{errors.ingredients.root.message}</p>}
        {errors.ingredients?.message && <p className="text-xs text-red-500 font-medium">{errors.ingredients.message}</p>}
        <Button
          variant="emerald"
          onClick={() => append({ material_id: '', cantidad: '' })}
          className="text-xs py-1.5 px-3 font-bold"
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Agregar Ingrediente
        </Button>
      </div>

      <p className="text-xs text-gray-500">El costo de producción se calcula en el servidor con el costo actual de cada material.</p>

      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" isLoading={mutacion.isPending} className="font-bold">
          {receta ? 'Guardar cambios' : 'Crear receta'}
        </Button>
      </div>
    </form>
  );
};

export const RecetasView = () => {
  const { data: recetas = [], isPending, isError, error, refetch } = useRecetas();
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ receta: Receta | null } | null>(null);

  const seleccionada = recetas.find((r) => r.id === seleccionadaId) ?? recetas[0];

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-green-600" />
            Recetas & Productos del Menú
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Escandallo de recetas, costos de producción y fórmula de ingredientes</p>
        </div>
        <Button variant="primary" onClick={() => setEditor({ receta: null })} icon={<Plus className="w-4 h-4" />} className="font-bold">
          Nueva Receta
        </Button>
      </div>

      {isPending ? (
        <LoadingSpinner label="Cargando recetas..." />
      ) : isError ? (
        <ErrorAlert error={error} titulo="No se pudieron cargar las recetas" onReintentar={() => refetch()} />
      ) : !seleccionada ? (
        <p className="py-10 text-center text-sm text-gray-500">Aún no hay recetas. Crea la primera con "Nueva Receta".</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Platos del Menú</h3>
            {recetas.map((rec) => (
              <button
                key={rec.id}
                type="button"
                aria-pressed={seleccionada.id === rec.id}
                onClick={() => setSeleccionadaId(rec.id)}
                className={`w-full text-left p-4 rounded-2xl border transition duration-200 cursor-pointer ${
                  seleccionada.id === rec.id ? 'bg-emerald-50/90 border-emerald-300 shadow-sm' : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {rec.code && <span className="text-xs font-mono text-emerald-700 font-bold">{rec.code}</span>}
                <h4 className="text-base font-bold text-gray-900 mt-0.5">{rec.name}</h4>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                  Costo: {pesos(rec.cost)} | Precio: {pesos(rec.price)}
                </p>
              </button>
            ))}
          </div>

          <div className="md:col-span-2 space-y-5 bg-gray-50/70 p-6 rounded-3xl border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200">
              <div>
                {seleccionada.code && <span className="text-xs font-mono font-bold text-emerald-600">{seleccionada.code}</span>}
                <h3 className="text-xl font-extrabold text-gray-900">{seleccionada.name}</h3>
              </div>

              <div className="flex items-center gap-4 text-sm font-bold">
                <div>
                  <span className="text-xs text-gray-400 block font-normal">Costo Producción</span>
                  <span className="text-gray-900">{pesos(seleccionada.cost)}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-normal">Precio Venta</span>
                  <span className="text-emerald-600">{pesos(seleccionada.price)}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-normal">Margen</span>
                  <span className={seleccionada.margen < 0 ? 'text-red-600' : 'text-blue-600'}>
                    {seleccionada.margen_pct === null ? '—' : `${seleccionada.margen_pct}%`}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-800">Fórmula de la Receta</h4>
                <Button
                  variant="emerald"
                  onClick={() => setEditor({ receta: seleccionada })}
                  className="text-xs py-1.5 px-3 font-bold"
                  icon={<Pencil className="w-3.5 h-3.5" />}
                >
                  Editar receta
                </Button>
              </div>

              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs font-bold text-gray-400 border-b border-gray-200">
                    <th className="py-2">Ingrediente / Material</th>
                    <th className="py-2">Cantidad por Porción</th>
                    <th className="py-2 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/60 font-medium">
                  {seleccionada.ingredients.map((ing) => (
                    <tr key={ing.material_id}>
                      <td className="py-2.5 font-semibold text-gray-800">{ing.item}</td>
                      <td className="py-2.5 text-gray-600">{ing.quantity}</td>
                      <td className="py-2.5 text-right font-bold text-gray-900">{pesos(ing.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <FormModal
        abierto={editor !== null}
        titulo={editor?.receta ? `Editar ${editor.receta.name}` : 'Nueva receta'}
        onCerrar={() => setEditor(null)}
        ancho="lg"
      >
        {editor && <FormularioReceta receta={editor.receta} onListo={() => setEditor(null)} />}
      </FormModal>
    </div>
  );
};
