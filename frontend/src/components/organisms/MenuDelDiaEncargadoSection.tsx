import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Utensils, Power, CheckCircle2, Save, Loader2 } from 'lucide-react';
import { FormField } from '../molecules/FormField';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { useCambiarEstadoMenu, useMenus, usePublicarMenu } from '../../hooks/useMenu';
import { hoyBogota, pesos } from '../../lib/formato';

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
  priceGuests: entero('el precio para invitados'),
  availableQuantity: entero('la cantidad disponible'),
});

type MenuFormData = z.infer<typeof menuSchema>;

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
      priceGuests: '8000',
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
        priceGuests: String(activeMenu.precio_invitado),
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
        precio_invitado: Number(data.priceGuests),
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
    <div className="space-y-6">
      {/* Current Active Menu Status Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                Menú Actual en Servicio
              </h2>
              {isLoading ? (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando...
                </span>
              ) : isMenuAvailable ? (
                <Badge variant="green">Disponible</Badge>
              ) : (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
                  No Disponible
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              {activeMenu ? `${activeMenu.nombre} · ${activeMenu.fecha}` : 'Aún no hay menús publicados'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleToggleAvailable}
              disabled={!activeMenu}
              isLoading={toggleStatusMutation.isPending}
              icon={<Power className="w-4 h-4 text-red-600" />}
              className="text-red-700 border-red-200 hover:bg-red-50 font-bold"
            >
              {isMenuAvailable ? 'Marcar como No Disponible' : 'Marcar como Disponible'}
            </Button>
          </div>
        </div>

        {statusFeedback && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{statusFeedback}</span>
          </div>
        )}

        {isError && (
          <div className="mb-4">
            <ErrorAlert error={error} titulo="No se pudo conectar con el servicio de menú" />
          </div>
        )}
        {toggleStatusMutation.isError && (
          <div className="mb-4">
            <ErrorAlert error={toggleStatusMutation.error} titulo="No se pudo cambiar el estado del menú" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm pt-2">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/70">
            <p className="text-xs text-gray-400 font-semibold uppercase">Precio Estudiantes</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-0.5">
              {activeMenu ? pesos(activeMenu.precio_aprendiz) : '—'}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/70">
            <p className="text-xs text-gray-400 font-semibold uppercase">Precio Invitados</p>
            <p className="text-xl font-extrabold text-blue-600 mt-0.5">
              {activeMenu ? pesos(activeMenu.precio_invitado) : '—'}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/70">
            <p className="text-xs text-gray-400 font-semibold uppercase">Vendidos Hoy</p>
            <p className="text-xl font-extrabold text-gray-800 mt-0.5">
              {activeMenu ? `${activeMenu.cantidad_vendida} / ${activeMenu.cantidad_disponible}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Form: Configurar Nuevo Menú */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
        <div className="mb-6 pb-4 border-b border-gray-100">
          <h3 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Utensils className="w-6 h-6 text-green-600" />
            Configurar / Actualizar Menú
          </h3>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Define el plato y las tarifas vigentes en el comedor estudiantil
          </p>
        </div>

        {publishMutation.isError && (
          <div className="mb-4">
            <ErrorAlert error={publishMutation.error} titulo="No se pudo publicar el menú" />
          </div>
        )}

        {publishSuccess && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>¡El menú fue guardado y publicado en la base de datos con éxito!</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onPublish)} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Nombre del Plato Principal"
              placeholder="Ej: Menú Ejecutivo SENA"
              required
              error={errors.dishName?.message}
              {...register('dishName')}
            />

            <FormField
              label="Fecha del Menú"
              type="date"
              required
              error={errors.date?.message}
              {...register('date')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
              Descripción Completa de Componentes
            </label>
            <textarea
              rows={3}
              placeholder="Ej: Almuerzo completo: Sopa de verduras, bandeja con carne asada, arroz, ensalada fresca..."
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1 font-medium">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="Precio Aprendiz (COP)"
              placeholder="5000"
              required
              error={errors.priceStudents?.message}
              {...register('priceStudents')}
            />

            <FormField
              label="Precio Invitado (COP)"
              placeholder="8000"
              required
              error={errors.priceGuests?.message}
              {...register('priceGuests')}
            />

            <FormField
              label="Cantidad de Porciones Disponibles"
              placeholder="200"
              required
              error={errors.availableQuantity?.message}
              {...register('availableQuantity')}
            />
          </div>

          <div className="pt-3 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              isLoading={publishMutation.isPending}
              icon={<Save className="w-4 h-4" />}
              className="bg-green-600 hover:bg-green-700 shadow-green-600/30 font-bold px-6 py-2.5"
            >
              Guardar y Publicar Menú
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
