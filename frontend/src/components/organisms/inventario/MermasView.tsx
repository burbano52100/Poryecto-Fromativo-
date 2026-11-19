import { Fragment } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, Separator, toast } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { EmptyMessage } from '../../molecules/EmptyMessage';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { FormField } from '../../molecules/FormField';
import { ListSkeleton } from '../../molecules/ListSkeleton';
import { SectionCard } from '../../molecules/SectionCard';
import { SelectField } from '../../molecules/SelectField';
import { useMateriales, useMermas, useRegistrarMerma } from '../../../hooks/useInventario';
import { mermaSchema, type MermaData, type MermaForm } from '../../../schemas/inventario.schema';
import { soloNumeros } from '../../../lib/numeros';

export const MermasView = () => {
  const { data: materiales = [] } = useMateriales();
  const { data: mermas = [], isPending, isError, error, refetch } = useMermas();
  const registrar = useRegistrarMerma();

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
        toast.success('Merma registrada', { description: 'Se descontó del stock y quedó en el Kardex.' });
      },
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <SectionCard titulo="Registrar merma" descripcion="Desperdicios, alimentos vencidos o deterioro">

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {registrar.isError && <ErrorAlert error={registrar.error} titulo="No se pudo registrar la merma" />}

          <div className="grid gap-4 sm:grid-cols-3">
            <Controller
              name="material_id"
              control={control}
              render={({ field }) => (
                <SelectField
                  label="Material afectado"
                  placeholder="Selecciona…"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.material_id?.message}
                  opciones={materiales.map((m) => ({ id: m.id, label: `${m.name} (${m.stock} ${m.unit})` }))}
                />
              )}
            />
            <FormField
              id="merma-cantidad"
              label={`Cantidad perdida ${materialElegido ? `(${materialElegido.unit})` : ''}`.trim()}
              placeholder="Ej: 2.5"
              error={errors.quantity?.message}
              {...soloNumeros(register('quantity'))}
            />
            <FormField
              id="merma-razon"
              label="Razón detallada"
              placeholder="Ej: Vencimiento / Daño por empaque"
              error={errors.reason?.message}
              {...register('reason')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="tertiary" onPress={() => reset()}>
              Limpiar
            </Button>
            <Button type="submit" isPending={registrar.isPending}>
              Registrar Merma
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard titulo="Mermas registradas recientemente">
        {isPending ? (
          <ListSkeleton label="Cargando mermas..." filas={3} />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudieron cargar las mermas" onReintentar={() => refetch()} />
        ) : mermas.length === 0 ? (
          <EmptyMessage>No hay mermas registradas.</EmptyMessage>
        ) : (
          <Card variant="secondary" className="gap-0 p-0">
            {mermas.map((m, i) => (
              <Fragment key={m.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{m.material}</p>
                    <p className="text-xs text-muted">
                      {m.date} · {m.reason}
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-medium tabular-nums text-danger">-{m.quantity}</span>
                </div>
              </Fragment>
            ))}
          </Card>
        )}
      </SectionCard>
    </div>
  );
};
