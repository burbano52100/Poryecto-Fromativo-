import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Clock, IdCard, Lock, Mail } from 'lucide-react';
import { Alert, Modal } from '@heroui/react';
import {
  esSolicitud,
  registerSchema,
  type RegisterFormInput,
  type RegistrableAccountType,
} from '../../schemas/auth.schema';
import { useRegisterMutation } from '../../hooks/useAuth';
import { AccountTypeSelector } from '../molecules/AccountTypeSelector';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { soloNumeros } from '../../lib/numeros';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLACEHOLDER_CORREO: Record<RegistrableAccountType, string> = {
  aprendiz: 'usuario@misena.edu.co',
  instructor: 'nombre@sena.edu.co',
};

export const RegisterModal = ({ isOpen, onClose }: RegisterModalProps) => {
  // Solo si la cédula ya estaba en una carga masiva: la cuenta se activa e inicia sesión (201)
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Caso normal: la cuenta queda pendiente del Coordinador y no se inicia sesión (ADR 018)
  const [solicitudEnviada, setSolicitudEnviada] = useState<string | null>(null);
  const [currentAccountType, setCurrentAccountType] = useState<RegistrableAccountType>('aprendiz');
  const registerMutation = useRegisterMutation();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      document: '',
      accountType: 'aprendiz',
      ficha: '',
      email: '',
      password: '',
    },
  });

  const handleAccountTypeChange = (type: RegistrableAccountType) => {
    setCurrentAccountType(type);
    setValue('accountType', type, { shouldValidate: true });
  };

  const handleClose = () => {
    reset();
    setCurrentAccountType('aprendiz');
    setSuccessMessage(null);
    setSolicitudEnviada(null);
    registerMutation.reset();
    onClose();
  };

  const onSubmit = handleSubmit((data) => {
    registerMutation.mutate(data, {
      onSuccess: (res) => {
        if (esSolicitud(res)) {
          // No se cierra solo: la persona debe leer que su cuenta espera aprobación
          setSolicitudEnviada(res.message);
          reset();
          setCurrentAccountType('aprendiz');
          return;
        }
        setSuccessMessage(res.message);
        reset();
        setCurrentAccountType('aprendiz');
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 1800);
      },
    });
  });

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(abierto) => {
        if (!abierto) handleClose();
      }}
    >
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label="Cerrar registro" />

          {solicitudEnviada ? (
            <>
              <Modal.Header className="items-center text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground">
                  <Clock className="size-6" />
                </div>
                <Modal.Heading>Solicitud enviada</Modal.Heading>
              </Modal.Header>
              <Modal.Body role="status" className="flex flex-col gap-2 text-center text-sm text-muted">
                <p>{solicitudEnviada}</p>
                <p className="text-xs">Cuando la aprueben, ingresa con tu documento y la contraseña que acabas de crear.</p>
              </Modal.Body>
              <Modal.Footer>
                <Button fullWidth onPress={handleClose}>
                  Entendido
                </Button>
              </Modal.Footer>
            </>
          ) : (
            <>
              <Modal.Header>
                <Modal.Heading>Crear cuenta</Modal.Heading>
                <p className="text-sm text-muted">
                  El Coordinador revisa cada solicitud antes de activar la cuenta.
                </p>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                {registerMutation.isError && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        {registerMutation.error instanceof Error
                          ? registerMutation.error.message
                          : 'Error al registrar la cuenta en SARA.'}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                {successMessage && (
                  <Alert status="success">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>{successMessage}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                <AccountTypeSelector selectedType={currentAccountType} onSelect={handleAccountTypeChange} />

                <Alert status="warning">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      Tu cuenta de {currentAccountType} necesita aprobación: el Coordinador revisará tu solicitud antes
                      de que puedas ingresar.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>

                <form id="form-registro" onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
                  <FormField
                    label="Nombre completo"
                    placeholder="Ej: Carlos Andrés Ruiz"
                    required
                    error={errors.name?.message}
                    {...register('name')}
                  />

                  <FormField
                    label="Número de documento"
                    placeholder="Ej: 1005678901"
                    required
                    icon={<IdCard className="size-4" />}
                    error={errors.document?.message}
                    {...soloNumeros(register('document'), 'entero')}
                  />

                  {currentAccountType === 'aprendiz' && (
                    <FormField
                      label="Número de ficha"
                      placeholder="Ej: 2847251"
                      required
                      icon={<BookOpen className="size-4" />}
                      error={errors.ficha?.message}
                      {...register('ficha')}
                    />
                  )}

                  <FormField
                    label="Correo institucional"
                    type="email"
                    placeholder={PLACEHOLDER_CORREO[currentAccountType]}
                    required
                    icon={<Mail className="size-4" />}
                    error={errors.email?.message}
                    {...register('email')}
                  />

                  <FormField
                    label="Contraseña"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    required
                    icon={<Lock className="size-4" />}
                    error={errors.password?.message}
                    {...register('password')}
                  />
                </form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit" form="form-registro" isPending={registerMutation.isPending}>
                  Enviar solicitud
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
