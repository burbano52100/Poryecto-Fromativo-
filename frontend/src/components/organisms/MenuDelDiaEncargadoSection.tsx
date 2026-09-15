import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Utensils, Edit3, Power, CheckCircle2, Save } from 'lucide-react';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';

const menuSchema = z.object({
  dishName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  date: z.string().min(1, 'Selecciona una fecha válida'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  priceStudents: z.string().min(1, 'Ingresa el precio para estudiantes'),
  priceGuests: z.string().min(1, 'Ingresa el precio para invitados'),
  availableQuantity: z.string().min(1, 'Ingresa la cantidad disponible'),
});

type MenuFormData = z.infer<typeof menuSchema>;

export const MenuDelDiaEncargadoSection = () => {
  const [isMenuAvailable, setIsMenuAvailable] = useState(true);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [draftSuccess, setDraftSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      dishName: 'Menú del Día',
      date: new Date().toISOString().split('T')[0],
      description: 'Almuerzo completo: Sopa, bandeja con proteína, arroz, ensalada, jugo natural y postre',
      priceStudents: '5000',
      priceGuests: '8000',
      availableQuantity: '200',
    },
  });

  const onPublish = (data: MenuFormData) => {
    console.log('Publicando menú:', data);
    setPublishSuccess(true);
    setTimeout(() => setPublishSuccess(false), 3500);
  };

  const onSaveDraft = () => {
    setDraftSuccess(true);
    setTimeout(() => setDraftSuccess(false), 3500);
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
              {isMenuAvailable ? (
                <Badge variant="green">Disponible</Badge>
              ) : (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
                  No Disponible
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Almuerzo completo del día de hoy
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
              icon={<Edit3 className="w-4 h-4" />}
            >
              Editar Menú
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsMenuAvailable(!isMenuAvailable)}
              icon={<Power className="w-4 h-4 text-red-600" />}
              className="text-red-700 border-red-200 hover:bg-red-50 font-bold"
            >
              {isMenuAvailable ? 'Marcar como No Disponible' : 'Marcar como Disponible'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm pt-2">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/70">
            <p className="text-xs text-gray-400 font-semibold uppercase">Precio Estudiantes</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-0.5">$5.000</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/70">
            <p className="text-xs text-gray-400 font-semibold uppercase">Precio Invitados</p>
            <p className="text-xl font-extrabold text-blue-600 mt-0.5">$8.000</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/70">
            <p className="text-xs text-gray-400 font-semibold uppercase">Vendidos Hoy</p>
            <p className="text-xl font-extrabold text-gray-800 mt-0.5">125 / 200</p>
          </div>
        </div>
      </div>

      {/* Form: Configurar Nuevo Menú */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
        <div className="mb-6 pb-4 border-b border-gray-100">
          <h3 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Utensils className="w-6 h-6 text-green-600" />
            Configurar Nuevo Menú
          </h3>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Define el menú que estará disponible para mañana o próximas fechas
          </p>
        </div>

        {publishSuccess && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>¡Menú guardado y publicado correctamente para los aprendices e instructores!</span>
          </div>
        )}

        {draftSuccess && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 text-blue-800 text-sm font-semibold">
            <Save className="w-5 h-5 text-blue-600 shrink-0" />
            <span>¡Borrador de menú guardado exitosamente!</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onPublish)} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Nombre del Plato"
              error={errors.dishName?.message}
              {...register('dishName')}
            />

            <FormField
              label="Fecha"
              type="date"
              error={errors.date?.message}
              {...register('date')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Descripción del Menú
            </label>
            <textarea
              rows={3}
              className={`w-full rounded-2xl p-3.5 text-sm bg-gray-50 border transition focus:outline-none focus:bg-white ${
                errors.description
                  ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                  : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
              }`}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs font-semibold text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FormField
                label="Precio Estudiantes"
                type="number"
                error={errors.priceStudents?.message}
                {...register('priceStudents')}
              />
              <p className="text-[11px] text-gray-400 mt-1 font-medium">Precio fijo subsidiado</p>
            </div>

            <FormField
              label="Precio Invitados"
              type="number"
              error={errors.priceGuests?.message}
              {...register('priceGuests')}
            />

            <FormField
              label="Cantidad Disponible"
              type="number"
              error={errors.availableQuantity?.message}
              {...register('availableQuantity')}
            />
          </div>

          <div className="pt-4 flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              variant="primary"
              className="bg-green-600 hover:bg-green-700 shadow-green-600/30 font-bold px-6 py-3"
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Guardar y Publicar Menú
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onSaveDraft}
              className="font-bold px-6 py-3"
            >
              Guardar como Borrador
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
