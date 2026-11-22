import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button as HeroButton, Card, Input, ListBox, Table } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { FieldMessage } from '../../atoms/FieldMessage';
import { EmptyMessage } from '../../molecules/EmptyMessage';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { FormField } from '../../molecules/FormField';
import { FormModal } from '../../molecules/FormModal';
import { ListSkeleton } from '../../molecules/ListSkeleton';
import { SectionCard } from '../../molecules/SectionCard';
import { SelectField } from '../../molecules/SelectField';
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {mutacion.isError && <ErrorAlert error={mutacion.error} titulo="No se pudo guardar la receta" />}
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Nombre del plato" required className="sm:col-span-2" error={errors.name?.message} {...register('name')} />
        <FormField label="Código" placeholder="REC-003" error={errors.code?.message} {...register('code')} />
        <FormField label="Precio de venta" required error={errors.price?.message} {...soloNumeros(register('price'), 'entero')} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">Ingredientes por porción</legend>
        {fields.map((field, index) => {
          const errorCantidad = errors.ingredients?.[index]?.cantidad?.message;
          return (
            <div key={field.id} className="flex items-start gap-2">
              <Controller
                name={`ingredients.${index}.material_id`}
                control={control}
                render={({ field: campo }) => (
                  <SelectField
                    label={`Material del ingrediente ${index + 1}`}
                    ocultarLabel
                    placeholder="Selecciona un material"
                    className="flex-1"
                    name={campo.name}
                    value={campo.value}
                    onChange={campo.onChange}
                    onBlur={campo.onBlur}
                    error={errors.ingredients?.[index]?.material_id?.message}
                    opciones={materiales.map((m) => ({ id: m.id, label: `${m.name} (${m.unit})` }))}
                  />
                )}
              />
              <div className="flex w-28 flex-col gap-1">
                <Input
                  id={`ing-cantidad-${index}`}
                  aria-label={`Cantidad del ingrediente ${index + 1}`}
                  placeholder="0.250"
                  fullWidth
                  aria-invalid={errorCantidad ? true : undefined}
                  aria-describedby={errorCantidad ? `ing-cantidad-${index}-error` : undefined}
                  {...soloNumeros(register(`ingredients.${index}.cantidad`))}
                />
                {errorCantidad && <FieldMessage id={`ing-cantidad-${index}-error`}>{errorCantidad}</FieldMessage>}
              </div>
              <HeroButton
                isIconOnly
                variant="ghost"
                className="text-danger"
                onPress={() => remove(index)}
                isDisabled={fields.length === 1}
                aria-label={`Quitar ingrediente ${index + 1}`}
              >
                <Trash2 />
              </HeroButton>
            </div>
          );
        })}
        {errors.ingredients?.root?.message && <FieldMessage>{errors.ingredients.root.message}</FieldMessage>}
        {errors.ingredients?.message && <FieldMessage>{errors.ingredients.message}</FieldMessage>}
        <Button size="sm" variant="secondary" className="self-start" onPress={() => append({ material_id: '', cantidad: '' })}>
          <Plus />
          Agregar Ingrediente
        </Button>
      </fieldset>

      <p className="text-xs text-muted">El costo de producción se calcula en el servidor con el costo actual de cada material.</p>

      <Button type="submit" isPending={mutacion.isPending} className="self-end">
        {receta ? 'Guardar cambios' : 'Crear receta'}
      </Button>
    </form>
  );
};

export const RecetasView = () => {
  const { data: recetas = [], isPending, isError, error, refetch } = useRecetas();
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ receta: Receta | null } | null>(null);

  const seleccionada = recetas.find((r) => r.id === seleccionadaId) ?? recetas[0];

  return (
    <SectionCard
      titulo="Recetas y productos del menú"
      descripcion="Escandallo de recetas, costos de producción e ingredientes"
      acciones={
        <Button onPress={() => setEditor({ receta: null })}>
          <Plus />
          Nueva receta
        </Button>
      }
    >
      {isPending ? (
        <ListSkeleton label="Cargando recetas..." />
      ) : isError ? (
        <ErrorAlert error={error} titulo="No se pudieron cargar las recetas" onReintentar={() => refetch()} />
      ) : !seleccionada ? (
        <EmptyMessage>Aún no hay recetas. Crea la primera con "Nueva receta".</EmptyMessage>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          <ListBox
            aria-label="Platos del menú"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[seleccionada.id]}
            onSelectionChange={(keys) => {
              const [id] = keys === 'all' ? [] : [...keys];
              if (id) setSeleccionadaId(String(id));
            }}
            className="h-fit"
          >
            {recetas.map((rec) => (
              <ListBox.Item key={rec.id} id={rec.id} textValue={rec.name}>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{rec.name}</span>
                  <span className="text-xs text-muted">
                    {rec.code ? `${rec.code} · ` : ''}Costo {pesos(rec.cost)} · Precio {pesos(rec.price)}
                  </span>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>

          <Card variant="secondary" className="gap-4 md:col-span-2">
            <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
              <div>
                {seleccionada.code && <span className="font-mono text-xs text-muted">{seleccionada.code}</span>}
                <Card.Title className="text-lg">{seleccionada.name}</Card.Title>
              </div>
              <Button size="sm" variant="secondary" onPress={() => setEditor({ receta: seleccionada })}>
                <Pencil />
                Editar receta
              </Button>
            </Card.Header>

            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Costo de producción</dt>
                <dd className="font-medium tabular-nums text-foreground">{pesos(seleccionada.cost)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Precio de venta</dt>
                <dd className="font-medium tabular-nums text-foreground">{pesos(seleccionada.price)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Margen</dt>
                <dd className={`font-medium tabular-nums ${seleccionada.margen < 0 ? 'text-danger' : 'text-success'}`}>
                  {seleccionada.margen_pct === null ? '—' : `${seleccionada.margen_pct}%`}
                </dd>
              </div>
            </dl>

            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label={`Ingredientes de ${seleccionada.name}`}>
                  <Table.Header>
                    <Table.Column isRowHeader>Ingrediente</Table.Column>
                    <Table.Column>Cantidad por porción</Table.Column>
                    <Table.Column className="text-right">Costo</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {seleccionada.ingredients.map((ing) => (
                      <Table.Row key={ing.material_id} id={ing.material_id}>
                        <Table.Cell className="font-medium text-foreground">{ing.item}</Table.Cell>
                        <Table.Cell>{ing.quantity}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{pesos(ing.cost)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card>
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
    </SectionCard>
  );
};
