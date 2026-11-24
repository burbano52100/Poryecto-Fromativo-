import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Power, Save } from 'lucide-react';
import { Alert, Chip, Label, ProgressBar, Skeleton, toast } from '@heroui/react';
import { FormField } from '../molecules/FormField';
import { SelectField } from '../molecules/SelectField';
import { TextAreaField } from '../molecules/TextAreaField';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { SectionCard } from '../molecules/SectionCard';
import { Button } from '../atoms/Button';
import { IngredientesADescontar } from './IngredientesADescontar';
import {
  useCambiarEstadoMenu,
  useMenus,
  usePublicarMenu,
  useRecetasParaMenu,
  useSugerenciaPreparacion,
} from '../../hooks/useMenu';
import { hoyBogota, pesos } from '../../lib/formato';
import { soloNumeros } from '../../lib/numeros';

const entero = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, `Ingresa ${campo}`)
    .refine((v) => /^\d+$/.test(v), `${campo.charAt(0).toUpperCase()}${campo.slice(1)} debe ser un número entero`);

/** Opción del select para publicar sin receta (React Aria no admite una clave vacía). */
const SIN_RECETA = 'sin-receta';

const menuSchema = z.object({
  dishName: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres'),
  date: z.string().min(1, 'Selecciona una fecha válida'),
  description: z.string().trim().min(10, 'La descripción debe tener al menos 10 caracteres'),
  priceStudents: entero('el precio para aprendices'),
  priceInstructors: entero('el precio para instructores'),
  availableQuantity: entero('la cantidad disponible'),
  recetaId: z.string(),
});

/** El instructor paga distinto que el aprendiz (ADR 025); arranca en la tarifa de instructores de Almuerzos invitados. */
const PRECIO_INSTRUCTOR_POR_DEFECTO = '10000';

type MenuFormData = z.infer<typeof menuSchema>;


export const MenuDelDiaEncargadoSection = () => {

  // El menú más reciente en cualquier estado: así un menú "agotado" se puede reactivar
  const { data: menus, isLoading, isError, error } = useMenus();
  const activeMenu = menus?.[0];
  const isMenuAvailable = activeMenu?.estado === 'activo';
  const { data: recetas = [] } = useRecetasParaMenu();

  const publishMutation = usePublicarMenu();
  const toggleStatusMutation = useCambiarEstadoMenu();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      dishName: 'Menú Ejecutivo SENA',
      date: hoyBogota(),
      description: 'Almuerzo completo: sopa, bandeja con proteína, arroz, ensalada, jugo natural y postre',
      priceStudents: '5000',
      priceInstructors: PRECIO_INSTRUCTOR_POR_DEFECTO,
      availableQuantity: '200',
      recetaId: SIN_RECETA,
    },
  });

  const [recetaId, porcionesTexto, fecha] = useWatch({ control, name: ['recetaId', 'availableQuantity', 'date'] });
  const porciones = Number(porcionesTexto) || 0;
  const { data: sugerencia } = useSugerenciaPreparacion(fecha);

  // Precarga el formulario con el menú de hoy si ya existe
  useEffect(() => {
    if (activeMenu && activeMenu.fecha === hoyBogota()) {
      reset({
        dishName: activeMenu.nombre,
        date: activeMenu.fecha,
        description: activeMenu.descripcion || '',
        priceStudents: String(activeMenu.precio_aprendiz),
        priceInstructors: String(activeMenu.precio_instructor ?? activeMenu.precio_aprendiz),
        availableQuantity: String(activeMenu.cantidad_disponible),
        recetaId: activeMenu.receta_id ?? SIN_RECETA,
      });
    }
  }, [activeMenu, reset]);

  const onPublish = (data: MenuFormData) => {
    publishMutation.mutate(
      {
        nombre: data.dishName,
        fecha: data.date,
        descripcion: data.description,
        precio_aprendiz: Number(data.priceStudents),
        precio_instructor: Number(data.priceInstructors),
        cantidad_disponible: Number(data.availableQuantity),
        estado: 'activo',
        receta_id: data.recetaId === SIN_RECETA ? null : data.recetaId,
      },
      {
        onSuccess: () => {
          toast.success('Menú guardado y publicado');
        },
      }
    );
  };

  const handleToggleAvailable = () => {
    if (!activeMenu) return;
    const nextStatus = isMenuAvailable ? 'agotado' : 'activo';
    toggleStatusMutation.mutate(
      { id: activeMenu.id, estado: nextStatus },
      {
        onSuccess: () => {
          toast.success(`Estado del menú actualizado a: ${nextStatus}`);
        },
      }
    );
  };

  return (
    // Publicar el menú es la tarea de esta sección: va primero y resaltada. El estado del menú en
    // servicio queda al lado en pantallas anchas y debajo en el celular.
    <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
      <SectionCard
        principal
        className="lg:col-span-3"
        titulo="Publicar el menú del día"
        descripcion="Define el plato, el precio para aprendices e instructores y las porciones del comedor"
      >
        {publishMutation.isError && <ErrorAlert error={publishMutation.error} titulo="No se pudo publicar el menú" />}

        <form onSubmit={handleSubmit(onPublish)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Nombre del menú"
              placeholder="Ej: Menú Ejecutivo SENA"
              required
              error={errors.dishName?.message}
              {...register('dishName')}
            />
            <FormField label="Fecha del menú" type="date" required error={errors.date?.message} {...register('date')} />
          </div>

          <TextAreaField
            label="Qué incluye el menú"
            rows={3}
            placeholder="Ej: Sopa de verduras, carne asada, arroz y ensalada"
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Precio para aprendices (COP)"
              placeholder="5000"
              required
              error={errors.priceStudents?.message}
              {...soloNumeros(register('priceStudents'), 'entero')}
            />
            <FormField
              label="Precio para instructores (COP)"
              placeholder="10000"
              required
              error={errors.priceInstructors?.message}
              {...soloNumeros(register('priceInstructors'), 'entero')}
            />
            <FormField
              label="Porciones disponibles"
              placeholder="200"
              required
              error={errors.availableQuantity?.message}
              {...soloNumeros(register('availableQuantity'), 'entero')}
            />
          </div>

          {/* Sugerencia de preparación: promedio del mismo día de las semanas anteriores */}
          {sugerencia?.suficiente && sugerencia.sugerencia !== null && sugerencia.sugerencia !== porciones && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-3">
              <p className="text-sm text-foreground">{sugerencia.mensaje}</p>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setValue('availableQuantity', String(sugerencia.sugerencia), { shouldValidate: true })}
              >
                Usar {sugerencia.sugerencia} porciones
              </Button>
            </div>
          )}

          {/* La receta es la que hace que los ingredientes se descuenten solos al vender cada almuerzo */}
          <Controller
            control={control}
            name="recetaId"
            render={({ field }) => (
              <SelectField
                label="Receta"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                opciones={[
                  { id: SIN_RECETA, label: 'Sin receta: no descuenta inventario' },
                  ...recetas.map((r) => ({
                    id: r.id,
                    label: `${r.nombre} (${r.ingredientes} ${r.ingredientes === 1 ? 'ingrediente' : 'ingredientes'})`,
                  })),
                ]}
              />
            )}
          />

          {recetaId === SIN_RECETA ? (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>
                  Sin receta, los almuerzos de este menú no descuentan ingredientes del inventario.
                  {recetas.length === 0 && ' Primero crea la receta en Inventario, Recetas y productos.'}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : (
            <IngredientesADescontar recetaId={recetaId} porciones={porciones} />
          )}

          <Button type="submit" size="lg" isPending={publishMutation.isPending} className="self-end">
            <Save />
            Guardar y publicar
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        className="lg:col-span-2"
        titulo={
          <span className="flex items-center gap-2">
            Menú actual en servicio
            {isLoading ? (
              <Skeleton className="h-5 w-20 rounded-full" />
            ) : (
              <Chip size="sm" variant="soft" color={isMenuAvailable ? 'success' : 'danger'}>
                {isMenuAvailable ? 'Disponible' : 'No disponible'}
              </Chip>
            )}
          </span>
        }
        descripcion={activeMenu ? `${activeMenu.nombre} · ${activeMenu.fecha}` : 'Aún no hay menús publicados'}
        acciones={
          <Button
            variant={isMenuAvailable ? 'danger-soft' : 'secondary'}
            onPress={handleToggleAvailable}
            isDisabled={!activeMenu}
            isPending={toggleStatusMutation.isPending}
          >
            <Power />
            {isMenuAvailable ? 'Marcar como no disponible' : 'Marcar como disponible'}
          </Button>
        }
      >
        {isError && <ErrorAlert error={error} titulo="No se pudo conectar con el servicio de menú" />}
        {toggleStatusMutation.isError && (
          <ErrorAlert error={toggleStatusMutation.error} titulo="No se pudo cambiar el estado del menú" />
        )}

        {activeMenu && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            Receta:
            {activeMenu.receta_nombre ? (
              <span className="font-medium text-foreground">{activeMenu.receta_nombre}</span>
            ) : (
              <Chip size="sm" variant="soft" color="warning">
                Sin receta, no descuenta inventario
              </Chip>
            )}
          </p>
        )}

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          <div className="rounded-xl bg-surface-secondary p-4">
            <dt className="text-xs text-muted">Precio aprendices</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
              {activeMenu ? pesos(activeMenu.precio_aprendiz) : '—'}
            </dd>
            {activeMenu && (
              <dd className="mt-1 text-xs text-muted">
                Instructores: <span className="font-medium tabular-nums text-foreground">{pesos(activeMenu.precio_instructor)}</span>
              </dd>
            )}
          </div>
          <div className="rounded-xl bg-surface-secondary p-4">
            <dt className="text-xs text-muted">Vendidos hoy</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
              {activeMenu ? `${activeMenu.cantidad_vendida} / ${activeMenu.cantidad_disponible}` : '—'}
            </dd>
            {activeMenu && (
              <ProgressBar
                className="mt-2"
                size="sm"
                value={activeMenu.cantidad_vendida}
                maxValue={Math.max(activeMenu.cantidad_disponible, 1)}
                color={activeMenu.cantidad_vendida >= activeMenu.cantidad_disponible ? 'danger' : 'accent'}
              >
                <Label className="sr-only">Porciones vendidas</Label>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            )}
          </div>
        </dl>
      </SectionCard>
    </div>
  );
};
