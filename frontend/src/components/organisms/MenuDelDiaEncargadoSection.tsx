import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Power, Save } from 'lucide-react';
import { Alert, Chip, Skeleton } from '@heroui/react';
import { FormField } from '../molecules/FormField';
import { TextAreaField } from '../molecules/TextAreaField';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { SectionCard } from '../molecules/SectionCard';
import { Button } from '../atoms/Button';
import { useCambiarEstadoMenu, useMenus, usePublicarMenu } from '../../hooks/useMenu';
import { hoyBogota, pesos } from '../../lib/formato';
import { soloNumeros } from '../../lib/numeros';

const entero = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, `Ingresa ${campo}`)
    .refine((v) => /^\d+$/.test(v), `${campo.charAt(0).toUpperCase()}${campo.slice(1)} debe ser un número entero`);

const menuSchema = z.object({
  dishName: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres'),
  date: z.string().min(1, 'Selecciona una fecha válida'),
  description: z.string().trim().min(10, 'La descripción debe tener al menos 10 caracteres'),
  priceStudents: entero('el precio para aprendices'),
  availableQuantity: entero('la cantidad disponible'),
});

type MenuFormData = z.infer<typeof menuSchema>;

/** Aviso breve de éxito. */
const Aviso = ({ children }: { children: string }) => (
  <Alert status="success">
    <Alert.Indicator />
    <Alert.Content>
      <Alert.Description>{children}</Alert.Description>
    </Alert.Content>
  </Alert>
);

export const MenuDelDiaEncargadoSection = () => {
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // El menú más reciente en cualquier estado: así un menú "agotado" se puede reactivar
  const { data: menus, isLoading, isError, error } = useMenus();
  const activeMenu = menus?.[0];
  const isMenuAvailable = activeMenu?.estado === 'activo';

  const publishMutation = usePublicarMenu();
  const toggleStatusMutation = useCambiarEstadoMenu();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      dishName: 'Menú Ejecutivo SENA',
      date: hoyBogota(),
      description: 'Almuerzo completo: Sopa, bandeja con proteína, arroz, ensalada, jugo natural y postre',
      priceStudents: '5000',
      availableQuantity: '200',
    },
  });

  // Precarga el formulario con el menú de hoy si ya existe
  useEffect(() => {
    if (activeMenu && activeMenu.fecha === hoyBogota()) {
      reset({
        dishName: activeMenu.nombre,
        date: activeMenu.fecha,
        description: activeMenu.descripcion || '',
        priceStudents: String(activeMenu.precio_aprendiz),
        availableQuantity: String(activeMenu.cantidad_disponible),
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
        cantidad_disponible: Number(data.availableQuantity),
        estado: 'activo',
      },
      {
        onSuccess: () => {
          setPublishSuccess(true);
          setTimeout(() => setPublishSuccess(false), 3500);
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
          setStatusFeedback(`Estado del menú actualizado a: ${nextStatus}`);
          setTimeout(() => setStatusFeedback(null), 3000);
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        titulo={
          <span className="flex items-center gap-2">
            Menú actual en servicio
            {isLoading ? (
              <Skeleton className="h-5 w-20 rounded-full" />
            ) : (
              <Chip size="sm" variant="soft" color={isMenuAvailable ? 'success' : 'danger'}>
                {isMenuAvailable ? 'Disponible' : 'No Disponible'}
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
            {isMenuAvailable ? 'Marcar como No Disponible' : 'Marcar como Disponible'}
          </Button>
        }
      >
        {statusFeedback && <Aviso>{statusFeedback}</Aviso>}
        {isError && <ErrorAlert error={error} titulo="No se pudo conectar con el servicio de menú" />}
        {toggleStatusMutation.isError && (
          <ErrorAlert error={toggleStatusMutation.error} titulo="No se pudo cambiar el estado del menú" />
        )}

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-secondary p-4">
            <dt className="text-xs text-muted">Precio estudiantes</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
              {activeMenu ? pesos(activeMenu.precio_aprendiz) : '—'}
            </dd>
          </div>
          <div className="rounded-xl bg-surface-secondary p-4">
            <dt className="text-xs text-muted">Vendidos hoy</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
              {activeMenu ? `${activeMenu.cantidad_vendida} / ${activeMenu.cantidad_disponible}` : '—'}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        titulo="Configurar o actualizar menú"
        descripcion="Define el plato, el precio para estudiantes y las porciones del comedor"
      >
        {publishMutation.isError && <ErrorAlert error={publishMutation.error} titulo="No se pudo publicar el menú" />}
        {publishSuccess && <Aviso>¡El menú fue guardado y publicado con éxito!</Aviso>}

        <form onSubmit={handleSubmit(onPublish)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Nombre del Plato Principal"
              placeholder="Ej: Menú Ejecutivo SENA"
              required
              error={errors.dishName?.message}
              {...register('dishName')}
            />
            <FormField label="Fecha del Menú" type="date" required error={errors.date?.message} {...register('date')} />
          </div>

          <TextAreaField
            label="Descripción Completa de Componentes"
            rows={3}
            placeholder="Ej: Sopa de verduras, bandeja con carne asada, arroz, ensalada fresca..."
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Precio Aprendiz (COP)"
              placeholder="5000"
              required
              error={errors.priceStudents?.message}
              {...soloNumeros(register('priceStudents'), 'entero')}
            />
            <FormField
              label="Cantidad de Porciones Disponibles"
              placeholder="200"
              required
              error={errors.availableQuantity?.message}
              {...soloNumeros(register('availableQuantity'), 'entero')}
            />
          </div>

          <Button type="submit" isPending={publishMutation.isPending} className="self-end">
            <Save />
            Guardar y Publicar Menú
          </Button>
        </form>
      </SectionCard>
    </div>
  );
};
