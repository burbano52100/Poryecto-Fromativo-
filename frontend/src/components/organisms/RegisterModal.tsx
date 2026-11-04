import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, UserPlus, IdCard, BookOpen, Mail, Lock, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import {
  esSolicitud,
  registerSchema,
  requiereAprobacion,
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
  encargado: 'nombre@sena.edu.co',
  invitado: 'correo@ejemplo.com',
};

export const RegisterModal = ({ isOpen, onClose }: RegisterModalProps) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Instructor y encargado: la cuenta queda pendiente y no se inicia sesión (ADR 015)
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

  if (!isOpen) return null;

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
        setSuccessMessage(`¡Cuenta creada correctamente! Bienvenido ${res.user.name}.`);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 transform transition-all scale-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg">
            <UserPlus className="w-6 h-6 text-amber-300" />
            <span>Crear Cuenta - GastroSENA</span>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {solicitudEnviada ? (
          <div className="p-6 space-y-5 text-center" role="status">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-gray-900">Solicitud enviada</h3>
              <p className="text-sm text-gray-600">{solicitudEnviada}</p>
              <p className="text-xs text-gray-500">
                Cuando la aprueben, ingresa con tu documento y la contraseña que acabas de crear.
              </p>
            </div>
            <Button type="button" variant="primary" fullWidth onClick={handleClose}>
              Entendido
            </Button>
          </div>
        ) : (
        <div className="p-6 space-y-4 overflow-y-auto">
          {registerMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>
                {registerMutation.error instanceof Error
                  ? registerMutation.error.message
                  : 'Error al registrar la cuenta en GastroSENA.'}
              </span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs sm:text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="text-sm font-semibold text-gray-700 mb-1">
            Selecciona tu tipo de perfil:
          </div>
          <AccountTypeSelector
            selectedType={currentAccountType}
            onSelect={handleAccountTypeChange}
          />

          {requiereAprobacion(currentAccountType) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs sm:text-sm flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Las cuentas de <strong>{currentAccountType}</strong> necesitan aprobación: un encargado del comedor
                revisará tu solicitud antes de que puedas ingresar.
              </span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-3.5 pt-2">
            <FormField
              label="Nombre Completo"
              placeholder="Ej: Carlos Andrés Ruiz"
              required
              error={errors.name?.message}
              {...register('name')}
            />

            <FormField
              label="Cédula / Documento de Identidad"
              placeholder="Ej: 1005678901"
              required
              icon={<IdCard className="w-4 h-4" />}
              error={errors.document?.message}
              {...soloNumeros(register('document'), 'entero')}
            />

            {currentAccountType === 'aprendiz' && (
              <FormField
                label="Número de Ficha SENA"
                placeholder="Ej: 2847251"
                required
                icon={<BookOpen className="w-4 h-4" />}
                error={errors.ficha?.message}
                {...register('ficha')}
              />
            )}

            <FormField
              label="Correo Electrónico Institucional"
              type="email"
              placeholder={PLACEHOLDER_CORREO[currentAccountType]}
              required
              icon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <FormField
              label="Contraseña"
              type="password"
              placeholder="Mínimo 8 caracteres"
              required
              icon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={handleClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={registerMutation.isPending}
              >
                {requiereAprobacion(currentAccountType) ? 'Enviar solicitud' : 'Registrarme'}
              </Button>
            </div>
          </form>
        </div>
        )}
      </div>
    </div>
  );
};
