import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, UserPlus, IdCard, BookOpen, Mail, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { registerSchema, type RegisterFormInput, type AccountType } from '../../schemas/auth.schema';
import { useRegisterMutation } from '../../hooks/useAuth';
import { AccountTypeSelector } from '../molecules/AccountTypeSelector';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegisterModal = ({ isOpen, onClose }: RegisterModalProps) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const registerMutation = useRegisterMutation();

  const {
    register,
    handleSubmit,
    watch,
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

  const currentAccountType = watch('accountType') as AccountType;

  if (!isOpen) return null;

  const handleAccountTypeChange = (type: AccountType) => {
    setValue('accountType', type, { shouldValidate: true });
  };

  const handleClose = () => {
    reset();
    setSuccessMessage(null);
    onClose();
  };

  const onSubmit = handleSubmit((data) => {
    registerMutation.mutate(data, {
      onSuccess: (res) => {
        setSuccessMessage(`¡Cuenta creada correctamente! Bienvenido ${res.user.name}.`);
        reset();
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

          <AccountTypeSelector selectedType={currentAccountType} onSelect={handleAccountTypeChange} />

          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              label="Nombre Completo"
              placeholder="Ej: Carlos Andrés Ruiz"
              required
              icon={<UserPlus className="w-4 h-4" />}
              error={errors.name?.message}
              {...register('name')}
            />

            <FormField
              label="Cédula / Tarjeta de Identidad"
              placeholder="Ej: 1005678901"
              required
              icon={<IdCard className="w-4 h-4" />}
              error={errors.document?.message}
              {...register('document')}
            />

            {currentAccountType === 'aprendiz' && (
              <FormField
                label="ID de Ficha"
                placeholder="Ej: 2847251"
                required
                icon={<BookOpen className="w-4 h-4" />}
                error={errors.ficha?.message}
                {...register('ficha')}
              />
            )}

            <FormField
              label="Correo Electrónico"
              type="email"
              placeholder="tucorreo@sena.edu.co"
              required
              icon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <FormField
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              required
              icon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" variant="primary" fullWidth isLoading={registerMutation.isPending}>
              Crear Cuenta
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
