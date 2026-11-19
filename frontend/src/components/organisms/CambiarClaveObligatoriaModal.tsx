import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Lock, LogOut } from 'lucide-react';
import { Modal } from '@heroui/react';
import type { User } from '../../schemas/auth.schema';
import { Button } from '../atoms/Button';
import { FormField } from '../molecules/FormField';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { useCambiarClave, useLogout } from '../../hooks/useAuth';

const esquema = (documento: string) =>
  z
    .object({
      actual: z.string().min(1, 'Escribe tu contraseña actual.'),
      nueva: z
        .string()
        .min(8, 'La nueva contraseña debe tener al menos 8 caracteres.')
        .max(72, 'La contraseña no puede superar 72 caracteres.'),
      confirmar: z.string(),
    })
    .refine((d) => d.nueva !== d.actual, { message: 'La nueva contraseña debe ser distinta de la actual.', path: ['nueva'] })
    .refine((d) => d.nueva !== documento, { message: 'La nueva contraseña no puede ser tu número de documento.', path: ['nueva'] })
    .refine((d) => d.nueva === d.confirmar, { message: 'Las contraseñas no coinciden.', path: ['confirmar'] });

type Formulario = z.infer<ReturnType<typeof esquema>>;

/**
 * Bloquea el panel hasta que la persona cambie su contraseña inicial (su cédula). Aparece en el
 * primer ingreso de una cuenta creada por carga masiva o con la clave restablecida por el Coordinador.
 * No se puede cerrar con Escape ni tocando el fondo: solo guardando la clave o saliendo.
 */
export const CambiarClaveObligatoriaModal = ({ user }: { user: User }) => {
  const cambiarClave = useCambiarClave();
  const cerrarSesion = useLogout();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema(user.document)),
    defaultValues: { actual: '', nueva: '', confirmar: '' },
  });

  const onSubmit = handleSubmit(({ actual, nueva }) => cambiarClave.mutate({ actual, nueva }));

  return (
    <Modal.Backdrop isOpen isDismissable={false} isKeyboardDismissDisabled variant="blur">
      <Modal.Container size="sm" scroll="inside">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Icon className="bg-warning-soft text-warning-soft-foreground">
              <KeyRound className="size-5" />
            </Modal.Icon>
            <Modal.Heading>Cambia tu contraseña</Modal.Heading>
            <p className="text-sm text-muted">
              Hola, {user.name}. Tu contraseña actual es tu número de documento: crea una nueva para continuar.
            </p>
          </Modal.Header>
          <Modal.Body>
            <form id="form-cambiar-clave" onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
              {cambiarClave.isError && <ErrorAlert error={cambiarClave.error} titulo="No se pudo cambiar la contraseña" />}
              <FormField
                label="Contraseña actual (tu documento)"
                type="password"
                autoComplete="current-password"
                icon={<Lock className="size-4" />}
                error={errors.actual?.message}
                {...register('actual')}
              />
              <FormField
                label="Nueva contraseña"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                icon={<Lock className="size-4" />}
                error={errors.nueva?.message}
                {...register('nueva')}
              />
              <FormField
                label="Repite la nueva contraseña"
                type="password"
                autoComplete="new-password"
                icon={<Lock className="size-4" />}
                error={errors.confirmar?.message}
                {...register('confirmar')}
              />
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={cerrarSesion}>
              <LogOut /> Salir
            </Button>
            <Button type="submit" form="form-cambiar-clave" isPending={cambiarClave.isPending}>
              Guardar contraseña
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
