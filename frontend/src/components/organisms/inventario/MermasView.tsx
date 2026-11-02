import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../atoms/Button';
import { LoadingSpinner } from '../../atoms/LoadingSpinner';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { useMateriales, useMermas, useRegistrarMerma } from '../../../hooks/useInventario';
import { mermaSchema, type MermaData, type MermaForm } from '../../../schemas/inventario.schema';

const CAMPO = 'w-full bg-white border border-amber-300 rounded-xl p-2.5 text-sm font-medium focus:outline-none focus:border-amber-500';

export const MermasView = () => {
  const { data: materiales = [] } = useMateriales();
  const { data: mermas = [], isPending, isError, error, refetch } = useMermas();
  const registrar = useRegistrarMerma();
  const [mermaSuccess, setMermaSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<MermaForm, unknown, MermaData>({
    resolver: zodResolver(mermaSchema),
    defaultValues: { material_id: '', quantity: '', reason: '' },
  });

  const materialId = useWatch({ control, name: 'material_id' });
  const materialElegido = materiales.find((m) => m.id === materialId);

  const onSubmit = handleSubmit((data) =>
    registrar.mutate(data, {
      onSuccess: () => {
        reset();
        setMermaSuccess(true);
        setTimeout(() => setMermaSuccess(false), 3500);
      },
    })
  );

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-6">
      <div className="pb-4 border-b border-gray-100">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          Gestión de Mermas y Pérdidas
        </h2>
        <p className="text-sm text-gray-500 font-medium mt-1">Registro de desperdicios, alimentos vencidos o deterioro</p>
      </div>

      {mermaSuccess && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Merma registrada correctamente. Se descontó del stock y quedó en el Kardex.</span>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="bg-amber-50/50 p-6 rounded-3xl border border-amber-200 space-y-4">
        <h3 className="text-base font-extrabold text-amber-950">Registrar Nueva Merma</h3>
        {registrar.isError && <ErrorAlert error={registrar.error} titulo="No se pudo registrar la merma" />}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="merma-material" className="block text-xs font-bold text-amber-900 uppercase mb-1">
              Material Afectado
            </label>
            <select id="merma-material" {...register('material_id')} className={CAMPO}>
              <option value="">Selecciona…</option>
              {materiales.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.stock} {m.unit})
                </option>
              ))}
            </select>
            {errors.material_id && <p className="text-xs text-red-600 font-semibold mt-1">{errors.material_id.message}</p>}
          </div>

          <div>
            <label htmlFor="merma-cantidad" className="block text-xs font-bold text-amber-900 uppercase mb-1">
              Cantidad Perdida {materialElegido ? `(${materialElegido.unit})` : ''}
            </label>
            <input id="merma-cantidad" inputMode="decimal" placeholder="Ej: 2.5" {...register('quantity')} className={CAMPO} />
            {errors.quantity && <p className="text-xs text-red-600 font-semibold mt-1">{errors.quantity.message}</p>}
          </div>

          <div>
            <label htmlFor="merma-razon" className="block text-xs font-bold text-amber-900 uppercase mb-1">
              Razón Detallada
            </label>
            <input id="merma-razon" placeholder="Ej: Vencimiento / Daño por empaque" {...register('reason')} className={CAMPO} />
            {errors.reason && <p className="text-xs text-red-600 font-semibold mt-1">{errors.reason.message}</p>}
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => reset()}>
            Limpiar
          </Button>
          <Button type="submit" variant="primary" isLoading={registrar.isPending} className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-amber-600/30">
            Registrar Merma
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-700">Mermas Registradas Recientemente</h3>
        {isPending ? (
          <LoadingSpinner label="Cargando mermas..." />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar las mermas" onReintentar={() => refetch()} />
        ) : mermas.length === 0 ? (
          <p className="text-sm text-gray-500">No hay mermas registradas.</p>
        ) : (
          <div className="space-y-2">
            {mermas.map((m) => (
              <div key={m.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex justify-between items-center gap-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400 font-mono">{m.date}</span>
                  <h4 className="font-bold text-gray-900">{m.material}</h4>
                  <p className="text-xs text-gray-600 mt-0.5">{m.reason}</p>
                </div>
                <span className="font-extrabold text-red-600 text-base whitespace-nowrap">-{m.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
