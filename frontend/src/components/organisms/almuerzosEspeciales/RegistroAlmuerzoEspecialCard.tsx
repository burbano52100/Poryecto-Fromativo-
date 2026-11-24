import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarPlus } from 'lucide-react';
import { toast } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { FormField } from '../../molecules/FormField';
import { SectionCard } from '../../molecules/SectionCard';
import { SelectField } from '../../molecules/SelectField';
import { TextAreaField } from '../../molecules/TextAreaField';
import { useCrearAlmuerzoEspecial } from '../../../hooks/useAlmuerzosEspeciales';
import { useRecetasParaMenu } from '../../../hooks/useMenu';
import { hoyBogota, pesos } from '../../../lib/formato';
import { soloNumeros } from '../../../lib/numeros';
import {
  almuerzoEspecialSchema,
  DEPENDENCIAS,
  OTRA_DEPENDENCIA,
  SIN_RECETA,
  type AlmuerzoEspecialForm,
} from '../../../schemas/almuerzosEspeciales.schema';

const VACIO: AlmuerzoEspecialForm = {
  dependencia: DEPENDENCIAS[0],
  otraDependencia: '',
  responsable: '',
  numeroContrato: '',
  fecha: hoyBogota(),
  personas: '',
  menu: '',
  recetaId: SIN_RECETA,
  precio: '',
};

/**
 * Registro de un almuerzo especial: quién lo pide, el contrato, qué se sirve, a cuántas personas y a
 * qué precio. Queda programado; los ingredientes se descuentan cuando se marque entregado.
 */
export const RegistroAlmuerzoEspecialCard = ({ className = '' }: { className?: string }) => {
  const crear = useCrearAlmuerzoEspecial();
  const { data: recetas = [] } = useRecetasParaMenu();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AlmuerzoEspecialForm>({ resolver: zodResolver(almuerzoEspecialSchema), defaultValues: VACIO });

  const [dependencia, personas, precio] = useWatch({ control, name: ['dependencia', 'personas', 'precio'] });
  const total = (Number(personas) || 0) * (Number(precio) || 0);

  const registrar = (data: AlmuerzoEspecialForm) => {
    const solicitante = data.dependencia === OTRA_DEPENDENCIA ? data.otraDependencia : data.dependencia;
    crear.mutate(
      {
        solicitante,
        responsable: data.responsable,
        numero_contrato: data.numeroContrato || null,
        fecha: data.fecha,
        cantidad_personas: Number(data.personas),
        menu_descripcion: data.menu,
        receta_id: data.recetaId === SIN_RECETA ? null : data.recetaId,
        precio_unitario: Number(data.precio),
      },
      {
        onSuccess: (pedido) => {
          toast.success(`Almuerzo especial de ${pedido.solicitante} programado para ${pedido.cantidad_personas} personas`);
          reset({ ...VACIO, fecha: hoyBogota() });
        },
      }
    );
  };

  return (
    <SectionCard
      principal
      className={`h-fit ${className}`}
      titulo="Registrar almuerzo especial"
      descripcion="Pedidos por contrato con un menú distinto al del día"
    >
      {crear.isError && <ErrorAlert error={crear.error} titulo="No se pudo registrar el almuerzo especial" />}

      <form onSubmit={handleSubmit(registrar)} className="flex flex-col gap-4">
        <Controller
          control={control}
          name="dependencia"
          render={({ field }) => (
            <SelectField
              label="Quién lo pide"
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.dependencia?.message}
              opciones={[...DEPENDENCIAS, OTRA_DEPENDENCIA].map((d) => ({ id: d, label: d }))}
            />
          )}
        />
        {dependencia === OTRA_DEPENDENCIA && (
          <FormField
            label="Nombre de la dependencia"
            placeholder="Ej: Centro de Gestión Agroempresarial"
            required
            error={errors.otraDependencia?.message}
            {...register('otraDependencia')}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <FormField
            label="Responsable"
            placeholder="Ej: Coordinadora de Bienestar"
            required
            error={errors.responsable?.message}
            {...register('responsable')}
          />
          <FormField
            label="Contrato u orden"
            placeholder="Ej: CT-2026-118"
            error={errors.numeroContrato?.message}
            {...register('numeroContrato')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <FormField label="Fecha de entrega" type="date" required error={errors.fecha?.message} {...register('fecha')} />
          <FormField
            label="Personas"
            placeholder="Ej: 12"
            required
            error={errors.personas?.message}
            {...soloNumeros(register('personas'), 'entero')}
          />
        </div>

        <TextAreaField
          label="Qué se va a servir"
          rows={3}
          required
          placeholder="Ej: Lomo en salsa de champiñones, arroz con almendras, ensalada y postre"
          error={errors.menu?.message}
          {...register('menu')}
        />

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
                ...recetas.map((r) => ({ id: r.id, label: r.nombre })),
              ]}
            />
          )}
        />

        <FormField
          label="Precio por persona (COP)"
          placeholder="Ej: 18000"
          required
          error={errors.precio?.message}
          {...soloNumeros(register('precio'), 'entero')}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-accent/20 pt-4">
          <p className="text-sm text-foreground/80">
            Total del pedido <span className="block text-xl font-semibold tabular-nums text-foreground">{pesos(total)}</span>
          </p>
          <Button type="submit" size="lg" isPending={crear.isPending}>
            <CalendarPlus />
            Registrar pedido
          </Button>
        </div>
      </form>
    </SectionCard>
  );
};
