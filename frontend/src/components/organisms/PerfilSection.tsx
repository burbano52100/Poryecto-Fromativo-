import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, X } from 'lucide-react';
import { Avatar, Chip, Separator, toast } from '@heroui/react';
import type { User } from '../../schemas/auth.schema';
import { Button } from '../atoms/Button';
import { FormField } from '../molecules/FormField';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { SectionCard } from '../molecules/SectionCard';
import { iniciales, TITULO_ROL } from '../../lib/usuario';
import { useActualizarPerfil } from '../../hooks/usePerfil';
import { useResumenConsumos } from '../../hooks/useConsumos';
import { useMiCuenta } from '../../hooks/useCartera';
import { pesos } from '../../lib/formato';

const perfilSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().trim().email('Ingresa un correo institucional válido'),
  ficha: z.string().trim().optional(),
});

type PerfilForm = z.infer<typeof perfilSchema>;

export interface PerfilSectionProps {
  user: User;
}

const Dato = ({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs text-muted">{etiqueta}</dt>
    <dd className="mt-0.5 break-words font-medium text-foreground">{valor}</dd>
  </div>
);

export const PerfilSection = ({ user }: PerfilSectionProps) => {
  const isInstructor = user.role === 'instructor';
  // El Coordinador no reserva almuerzos: no tiene consumos que mostrar
  const consumeAlmuerzos = user.role === 'aprendiz' || isInstructor;
  const [isEditing, setIsEditing] = useState(false);

  const actualizarPerfil = useActualizarPerfil();
  const { data: resumen } = useResumenConsumos(consumeAlmuerzos);
  const { data: cuenta } = useMiCuenta(isInstructor);
  const saldoPendiente = cuenta?.pendingBalance ?? 0;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    values: { name: user.name, email: user.email, ficha: user.ficha ?? '' },
  });

  const toggleEdicion = () => {
    reset();
    actualizarPerfil.reset();
    setIsEditing(!isEditing);
  };

  const onSubmit = handleSubmit((data) => {
    actualizarPerfil.mutate(
      { name: data.name, email: data.email, ficha: isInstructor ? undefined : data.ficha || undefined },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success('¡Perfil actualizado correctamente!');
        },
      }
    );
  });

  return (
    <SectionCard
      titulo="Mi perfil"
      descripcion="Mantén tu información personal actualizada"
      acciones={
        <Button variant={isEditing ? 'tertiary' : 'secondary'} onPress={toggleEdicion}>
          {isEditing ? <X /> : <Pencil />}
          {isEditing ? 'Cancelar' : 'Editar Perfil'}
        </Button>
      }
    >

      <div className="flex items-center gap-4">
        <Avatar size="lg" color="accent" variant="soft">
          <Avatar.Fallback>{iniciales(user.name)}</Avatar.Fallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-foreground">{user.name}</p>
            <Chip size="sm" variant="soft" color="success">
              {user.status || 'ACTIVE'}
            </Chip>
          </div>
          <p className="text-sm text-muted">{TITULO_ROL[user.role]}</p>
        </div>
      </div>

      <Separator />

      {isEditing ? (
        <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
          {actualizarPerfil.isError && <ErrorAlert error={actualizarPerfil.error} titulo="No se pudo guardar el perfil" />}

          <FormField label="Nombre Completo" required error={errors.name?.message} {...register('name')} />
          <FormField
            label="Correo Institucional"
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          {user.role === 'aprendiz' && <FormField label="ID de Ficha" error={errors.ficha?.message} {...register('ficha')} />}

          <div className="flex justify-end gap-2">
            <Button variant="tertiary" onPress={toggleEdicion}>
              Cancelar
            </Button>
            <Button type="submit" isPending={actualizarPerfil.isPending}>
              Guardar Cambios
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta={isInstructor ? 'Cédula' : 'Cédula / Documento'} valor={user.document} />
          {user.role === 'aprendiz' && <Dato etiqueta="Ficha" valor={user.ficha || 'Sin ficha'} />}
          <Dato etiqueta="Correo institucional" valor={user.email || 'Sin correo registrado'} />
          {isInstructor && <Dato etiqueta="Tipo de cuenta" valor={cuenta?.paymentFrequency ?? 'Mensual'} />}
          {consumeAlmuerzos && <Dato etiqueta="Total de almuerzos" valor={resumen?.totalAlmuerzos ?? '…'} />}
          {isInstructor ? (
            <Dato
              etiqueta="Saldo"
              valor={
                <span className="flex items-center gap-2">
                  {pesos(saldoPendiente)}
                  <Chip size="sm" variant="soft" color={saldoPendiente <= 0 ? 'success' : 'warning'}>
                    {saldoPendiente <= 0 ? 'Al día' : 'Pendiente'}
                  </Chip>
                </span>
              }
            />
          ) : (
            consumeAlmuerzos && <Dato etiqueta="Total gastado" valor={resumen ? pesos(resumen.gastoTotal) : '…'} />
          )}
        </dl>
      )}
    </SectionCard>
  );
};
