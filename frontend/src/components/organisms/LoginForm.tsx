import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Users, 
  Camera, 
  BookOpen, 
  IdCard, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { loginSchema, type LoginInput, type AccountType } from '../../schemas/auth.schema';
import { useLoginMutation, useFacialLoginMutation } from '../../hooks/useAuth';
import { AccountTypeSelector } from '../molecules/AccountTypeSelector';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { DemoBanner } from '../molecules/DemoBanner';
import { RegisterModal } from './RegisterModal';

interface LoginFormProps {
  onLoginSuccess?: (accountType: AccountType, document: string) => void;
}

export const LoginForm = ({ onLoginSuccess }: LoginFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFacialModalOpen, setIsFacialModalOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  const loginMutation = useLoginMutation();
  const facialMutation = useFacialLoginMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      accountType: 'aprendiz',
      ficha: '',
      document: '',
      password: '',
    },
  });

  const currentAccountType = watch('accountType');

  const handleAccountTypeChange = (type: AccountType) => {
    setValue('accountType', type, { shouldValidate: true });
  };

  const handleFillDemo = () => {
    setValue('accountType', 'aprendiz', { shouldValidate: true });
    setValue('ficha', '2847251', { shouldValidate: true });
    setValue('document', '1005678901', { shouldValidate: true });
    setValue('password', 'demo123', { shouldValidate: true });
    setLocalFeedback('¡Credenciales demo cargadas! Presiona Iniciar Sesión.');
    setTimeout(() => setLocalFeedback(null), 3000);
  };

  const onSubmit = (data: LoginInput) => {
    loginMutation.mutate(data, {
      onSuccess: (res) => {
        setLocalFeedback(`¡Bienvenido ${res.user.name}! (${res.message})`);
        if (onLoginSuccess) {
          onLoginSuccess(res.user.role, res.user.document);
        }
      },
    });
  };

  const handleGuestLogin = () => {
    setLocalFeedback('Iniciando sesión en modo Invitado del Comedor...');
    setTimeout(() => setLocalFeedback(null), 3000);
  };

  const handleSimulateFacialSuccess = () => {
    facialMutation.mutate(
      { document: watch('document') || '1005678901' },
      {
        onSuccess: (res) => {
          setIsFacialModalOpen(false);
          setLocalFeedback(`¡Autenticación Facial Exitosa! Bienvenido ${res.user.name}.`);
        },
      }
    );
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-white/40 text-gray-900 transition-all duration-300">
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Iniciar Sesión
        </h2>
        <p className="text-sm text-gray-500 mt-1 font-medium">
          Ingresa con tus credenciales
        </p>
      </div>

      {loginMutation.isError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>
            {loginMutation.error instanceof Error
              ? loginMutation.error.message
              : 'Error al conectar con la API de GastroSENA.'}
          </span>
        </div>
      )}

      {(localFeedback || loginMutation.isSuccess) && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{localFeedback || loginMutation.data?.message}</span>
        </div>
      )}

      <AccountTypeSelector
        selectedType={currentAccountType}
        onSelect={handleAccountTypeChange}
      />

      <div className="space-y-3 mb-5">
        <Button variant="outline" fullWidth onClick={handleGuestLogin} icon={<Users className="w-4 h-4 text-gray-600" />}>
          Invitado
        </Button>

        <Button
          variant="emerald"
          fullWidth
          onClick={() => setIsFacialModalOpen(true)}
          icon={<Camera className="w-4 h-4 text-emerald-600 animate-pulse" />}
        >
          Ingresar con Reconocimiento Facial
        </Button>

        <p className="text-xs text-gray-500 text-center -mt-1 font-medium">
          Solo para aprendices SENA en Yamboro
        </p>
      </div>

      <div className="relative my-5 flex items-center justify-center">
        <div className="border-t border-gray-200 w-full"></div>
        <span className="bg-white px-3 text-xs text-gray-400 font-medium whitespace-nowrap absolute">
          O ingresa con contraseña
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label="ID de Ficha"
          placeholder="Ej: 2847251"
          required={currentAccountType === 'aprendiz'}
          icon={<BookOpen className="w-4 h-4" />}
          error={errors.ficha?.message}
          {...register('ficha')}
        />

        <FormField
          label="Cédula / Tarjeta de Identidad"
          placeholder="Ej: 1005678901"
          required
          icon={<IdCard className="w-4 h-4" />}
          error={errors.document?.message}
          {...register('document')}
        />

        <div>
          <FormField
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            required
            icon={<Lock className="w-4 h-4" />}
            error={errors.password?.message}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            {...register('password')}
          />

          <div className="text-right mt-1.5">
            <a
              href="#forgot"
              onClick={(e) => {
                e.preventDefault();
                alert('Se enviaron las instrucciones a tu correo institucional SENA.');
              }}
              className="text-xs text-green-600 hover:text-green-700 font-semibold hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={loginMutation.isPending}
        >
          Iniciar Sesión
        </Button>
      </form>

      {/* OPCIÓN A: Modal de Registro Real al hacer clic en Crear cuenta */}
      <div className="text-center mt-5 text-xs sm:text-sm text-gray-600">
        ¿No tienes cuenta?{' '}
        <button
          type="button"
          onClick={() => setIsRegisterOpen(true)}
          className="font-bold text-green-600 hover:text-green-700 hover:underline cursor-pointer"
        >
          Crear cuenta
        </button>
      </div>

      <DemoBanner onFillDemo={handleFillDemo} />

      {/* Modal de Registro */}
      <RegisterModal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />

      {/* Modal simulado de Reconocimiento Facial */}
      {isFacialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4 border border-emerald-200">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 border-4 border-emerald-300 animate-pulse">
              <Camera className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Escanear Rostro SENA</h3>
            <p className="text-xs text-gray-600">
              Colócate frente a la cámara del tótem biométrico en el Comedor Yamboro.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setIsFacialModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                fullWidth
                isLoading={facialMutation.isPending}
                onClick={handleSimulateFacialSuccess}
              >
                Simular Éxito
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
